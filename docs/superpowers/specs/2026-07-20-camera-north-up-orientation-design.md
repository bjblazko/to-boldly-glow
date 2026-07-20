# Camera North-Up Orientation — Design Specification

Status: Approved — 2026-07-20

## 1. Motivation

`OrbitCamera` has always orbited and rendered "up" relative to world **Y** — hardcoded into both
`getEyePosition()` (elevation raises the eye along Y; azimuth rotates in the world X/Z plane) and
`getViewMatrix()` (`mat4.lookAt(eye, target, [0, 1, 0])`).

Verified directly against the running app (not assumed): a real body's world position and its real
pole direction both live predominantly in **X/Y**, with **Z** as the small/out-of-plane axis —

```
Earth's world position:  [-2.96, 19.44, -0.011]   — X and Y carry the orbit, Z ≈ 0
Earth's real pole:       [0, 0.398, 0.917]         — mostly Z
ECLIPTIC_NORTH constant: [0, 0, 1]                 — Z
```

confirming `packages/engine/assembly/coordinates.ts`'s `sphericalToX/Y` (both carry
`cos(latitude)`, the in-plane factor) and `poleOrientation.ts`'s `ECLIPTIC_NORTH = [0,0,1]`: **the
scene's true ecliptic plane is X/Y, and true "north" is Z.** The camera's Y-up convention has never
matched this. It happens to *look* reasonable at the camera's default azimuth (0), because at that
one azimuth value the eye offset lands mostly along Z by coincidence of the formula, not because
elevation is doing anything meaningful relative to the real disk. Confirmed by computing the
default view's effective angle above the true ecliptic: `acos(0.921) ≈ 23°` from true Z — the
camera was already sitting ~67° above the real horizontal plane, despite its `elevation` parameter
reading 0.4 rad (~23°). Any azimuth away from 0 (dragging, or `defaultFramingAzimuth` aiming at the
Sun) moves the camera toward the *real* in-plane axes (X, Y) instead of staying at a constant true
elevation — which is the deeper, previously-unnoticed cause of the disorientation reported both as
"quirky" camera behavior in general and, specifically, Earth's north pole reading sideways on
screen when followed.

This spec fixes the convention at its root — rebasing the camera on the scene's real ecliptic
plane — rather than patching only the followed-body case on top of the mismatched Y-up baseline.

## 2. Scope

**In scope**:
- Generalizing `OrbitCamera` to orbit around a configurable up-axis, built from a proper
  orthonormal frame instead of hardcoded world Y/X/Z.
- Changing the *default* up-axis (used even when not following anything) from world Y to
  `ECLIPTIC_NORTH = [0, 0, 1]`, matching the scene's real convention.
- Setting the up-axis to the followed entity's own real pole direction as part of the existing
  fly-to tween, reusing `equatorialToEclipticPoleDirection`/`moonOrbitReferencePoleDirection` — the
  same data already driving that entity's rendered tilt (no new data).
- Generalizing `defaultFramingAzimuth` to compute an azimuth relative to the *current* up-axis's
  basis, not a hardcoded X/Z plane.
- Re-tuning `main.ts`'s initial `elevation`/`azimuth` camera defaults, since their old values were
  calibrated (accidentally) against the wrong axis and now need to express a genuinely equivalent
  "3/4 view from above the ecliptic" under the corrected semantics.

**Out of scope**:
- **Continuous north-lock during manual drag.** The followed-body pole override is a one-time
  default applied at fly-to, same as `defaultFramingAzimuth` already is. Once the tween ends,
  dragging works normally relative to the new resting axis and can rotate away from it freely.
- **Free-fly camera mode.** `FlyCamera` is a separate class with its own yaw/pitch controls, not
  built on `OrbitCamera`. Not touched.
- **Reconciling `Show orbit paths` rendering or any other subsystem's own axis handling.** Bodies
  and orbit paths already render correctly in the real X/Y-plane, Z-north convention (that's what
  the axial-tilt work established); only the *camera* has been out of step. No renderer changes.

## 3. Design

### 3.1 `OrbitCamera`'s orbit basis, generalized

Add `upAxis: vec3` to `OrbitCamera`, **defaulting to `ECLIPTIC_NORTH = [0, 0, 1]`** (imported from
`poleOrientation.ts`) instead of today's `[0, 1, 0]`. Build an orthonormal frame from it:

1. Reference vector `R = [1, 0, 0]` (world X) normally; fall back to `[0, 1, 0]` (world Y) if
   `|upAxis · R| > 0.999` (near-degenerate). Verified safe for every current body: the largest
   X-component among all 9 real poles (Sun through Neptune) is Mars at 0.446 — nowhere near the
   0.999 threshold. Uranus specifically (the steepest tilt, ~82° from Z) has pole `[-0.212,
   -0.968, 0.134]` — close to world **Y**, which is exactly why the fallback exists and why X (not
   Y) is the primary reference.
2. `forward0 = normalize(R - (R · upAxis) * upAxis)` (Gram-Schmidt).
3. `right = normalize(cross(upAxis, forward0))`.

```ts
getEyePosition(): vec3 {
  const cosEl = Math.cos(this.elevation)
  const { right, forward0 } = this.orbitBasis() // derives from upAxis; recomputed when upAxis changes
  const offset = vec3.create()
  vec3.scaleAndAdd(offset, offset, right, this.radius * cosEl * Math.sin(this.azimuth))
  vec3.scaleAndAdd(offset, offset, forward0, this.radius * cosEl * Math.cos(this.azimuth))
  vec3.scaleAndAdd(offset, offset, this.upAxis, this.radius * Math.sin(this.elevation))
  return vec3.add(vec3.create(), this.target, offset)
}

getViewMatrix(): mat4 {
  return mat4.lookAt(mat4.create(), this.getEyePosition(), this.target, this.upAxis)
}
```

With the new default `upAxis = ECLIPTIC_NORTH = [0,0,1]`: `R = [1,0,0]` is already perpendicular to
it, so `forward0 = [1,0,0]`, `right = cross([0,0,1], [1,0,0]) = [0,1,0]`. Azimuth 0 now points along
+X and sweeps toward +Y as azimuth increases — i.e. **azimuth now genuinely sweeps around the real
orbital plane**, and elevation genuinely raises the eye along the real out-of-plane axis. This is
the property the old Y-up formula never had except by accident at azimuth 0.

### 3.2 Re-tuning `main.ts`'s default camera parameters

`elevation` and `azimuth`'s *numbers* (`0.4`, `0`) were tuned against the old, mismatched axis, so
they must be re-derived, not carried over as-is. The equivalent default view — matching what users
already see today — sits `acos(0.921) ≈ 23°` off true north, i.e. **`elevation ≈ 67°` (`1.169`
rad)** under the corrected semantics; `azimuth = 0` still gives an arbitrary-but-fine starting
in-plane direction (now +X). This starting elevation value is a carried-over approximation of
today's accidental framing, not a first-principles pick — confirm it still looks like a sensible
"looking down and across at the solar system" default in the browser during implementation, and
adjust the constant if not (documented as a hand-tuned visual constant, consistent with this
codebase's existing `FRAMING_RADIUS_MULTIPLIER`/`EXPLORER_DISTANCE_SCALE`-style constants).

### 3.3 Generalizing `defaultFramingAzimuth`

Currently: `atan2(-tx, -tz)`, hardcoded to the X/Z plane. Generalize to accept the camera's current
basis and project the target direction onto it:

```ts
export function defaultFramingAzimuth(
  targetPosition: readonly [number, number, number],
  fallbackAzimuth: number,
  basis: { right: vec3; forward0: vec3 },
): number {
  const [tx, ty, tz] = targetPosition
  if (Math.hypot(tx, ty, tz) < 1e-9) return fallbackAzimuth
  const target = vec3.fromValues(-tx, -ty, -tz)
  return Math.atan2(vec3.dot(target, basis.right), vec3.dot(target, basis.forward0))
}
```

`basis` comes from `orbitCamera.orbitBasis()` at the moment `selectEntity()` builds the fly-to
tween — i.e. the basis in effect *before* the tween starts interpolating `upAxis` toward the
followed entity's pole. (The degenerate-target check changes from "target's X/Z both near zero" to
"target's full magnitude near zero," since a target's position could now have all its magnitude
concentrated in an axis that isn't X or Z depending on the current basis — only true for the Sun
itself, position `[0,0,0]`, so behavior is unchanged in practice.)

### 3.4 Wiring the followed-entity pole into fly-to

Add to `entities.ts` (alongside `entityWorldPosition`):

```ts
export function entityPoleDirection(entity: SolarSystemEntity): [number, number, number] {
  if (entity.kind === 'sun' || entity.kind === 'planet') {
    const body = entity.definition as BodyDefinition
    return equatorialToEclipticPoleDirection(body.poleRightAscensionDegrees, body.poleDeclinationDegrees)
  }
  const moon = entity.definition as MoonDefinition
  const parent = ALL_ENTITIES.find((e) => e.id === moon.parentId)
  if (!parent) throw new Error(`${moon.id} has no known parent ${moon.parentId}.`)
  return moonOrbitReferencePoleDirection(moon, parent.definition as BodyDefinition)
}
```

A straight dispatch to the two functions `main.ts` already calls to tilt each entity's own mesh
(`equatorialToEclipticPoleDirection` for Sun/planets at `main.ts:528,585`;
`moonOrbitReferencePoleDirection` for moons at `main.ts:634`) — same inputs, same outputs, exposed
once per entity instead of duplicated per call site.

In `CameraFollowController` (`cameraFollow.ts`):
- `FlyToTween` gains `startUpAxis`/`endUpAxis: [number, number, number]`.
- `selectEntity()` sets `endUpAxis: entityPoleDirection(entity)`, and computes
  `defaultFramingAzimuth` using the camera's *current* basis (§3.3) before the tween begins.
- `update()`'s tween step interpolates `upAxis` alongside target/radius/azimuth via a normalized
  lerp (`vec3.lerp` then `vec3.normalize` — adequate for a ≤1.5s tween; exact constant angular
  velocity isn't a requirement here), assigning the result to `orbitCamera.upAxis` each frame.
- `stopFollowing()` resets `orbitCamera.upAxis` to `ECLIPTIC_NORTH` — free browsing after
  un-following returns to the (new, corrected) default, consistent with radius/target already
  having no followed-entity semantics once unfollowed.

### 3.5 Edge cases

- **Reference-vector degeneracy**: handled by the X-primary/Y-fallback choice in §3.1, verified
  against every current body's real pole (§3.1 point 1). Both branches get a direct unit test.
- **`upAxis` momentarily near-zero during interpolation**: won't happen — no two real bodies have
  opposite poles, so `vec3.lerp` between two unit vectors never passes through the origin;
  `vec3.normalize` is applied every frame regardless, correcting any residual magnitude drift.
- **Following the Sun**: the Sun has real pole data (`SUN.poleRightAscensionDegrees/DeclinationDegrees`),
  so it goes through the same path as planets with no special case.
- **`MAX_ELEVATION` clamp** (`orbitCamera.ts`, `Math.PI / 2 - 0.01`): unchanged — its role (avoid
  gimbal-lock at true zenith) is now correctly realized against the real ecliptic instead of an
  accidental one.

## 4. Testing

- `orbitCamera.test.ts`: basis construction is correct for `upAxis = ECLIPTIC_NORTH` (the new
  default) and for a steeply-tilted axis (Uranus's real pole, exercising the X→Y reference
  fallback); `getEyePosition()`/`getViewMatrix()` produce orthonormal, non-degenerate results in
  both cases.
- `entities.test.ts`: `entityPoleDirection` returns `equatorialToEclipticPoleDirection`'s result
  for a planet and the Sun, and `moonOrbitReferencePoleDirection`'s result for a moon — proven to
  be the same value already driving that entity's rendered tilt, not a separate computation that
  could drift out of sync.
- `cameraFollow.test.ts` (or equivalent): a completed fly-to tween ends with `orbitCamera.upAxis`
  equal to the followed entity's pole direction; `stopFollowing()` resets it to `ECLIPTIC_NORTH`.
- `defaultFramingAzimuth`'s existing tests get parallel cases for a non-default basis (not just
  world X/Z), confirming the projection generalization is correct.
- Manual verification in the browser (per this project's established practice): the *unfollowed*
  default view still looks like a sensible 3/4 view of the solar system (re-tuned elevation, §3.2);
  flying to Earth at Realistic scale shows north (ice caps/coastlines) reading top-of-screen;
  flying to Uranus doesn't look eye-position/roll-mismatched; dragging azimuth all the way around
  in the unfollowed default view keeps a consistent, non-degenerating "orbit around the disk" feel
  instead of tipping into an edge-on view partway through.
