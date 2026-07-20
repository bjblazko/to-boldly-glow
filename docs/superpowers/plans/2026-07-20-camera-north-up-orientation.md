# Camera North-Up Orientation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebase `OrbitCamera` on the scene's real ecliptic-north axis (world Z, not world Y), and orient the camera to a followed entity's own real pole direction during fly-to, so following any body (especially at Realistic scale) shows its actual north pointing up on screen instead of an arbitrary direction.

**Architecture:** `OrbitCamera` gains a configurable `upAxis` (default `ECLIPTIC_NORTH = [0,0,1]`), with its eye-position/view-matrix math rebuilt around a proper orthonormal frame derived from that axis instead of hardcoded world Y/X/Z. `CameraFollowController` tweens `upAxis` toward the followed entity's real pole (reusing the same pole data already driving that entity's rendered tilt) as part of the existing fly-to animation, and `defaultFramingAzimuth` is generalized to compute its angle relative to whatever frame is currently in effect.

**Tech Stack:** TypeScript, `gl-matrix` (vec3/mat4), Vitest.

## Global Constraints

- Full spec: `docs/superpowers/specs/2026-07-20-camera-north-up-orientation-design.md` — read it if any task here is ambiguous.
- Follow TDD for every code change: write the failing test, run it and confirm it fails for the right reason, write minimal code to pass, run it and confirm it passes.
- Every existing test in `packages/app/test/` must keep passing except the specific tests this plan explicitly says to rewrite (their old expected values describe the old, now-incorrect Y-up behavior).
- Run `npx tsc --noEmit` (from `packages/app/`) after each task — it must be clean before moving on.
- No new dependencies. `gl-matrix` is already a dependency; the new pure-math helper in Task 1 uses plain number tuples (no `gl-matrix`), matching the style already used by `sceneScale.ts`/`moonOrbit.ts`'s standalone functions.
- All commands below assume the working directory is `/Users/blazko/Development/ToBoldlyGlow/packages/app`.

---

### Task 1: `orbitBasisForUpAxis` — the orthonormal frame helper

**Files:**
- Modify: `packages/app/src/camera/orbitCamera.ts`
- Test: `packages/app/test/orbitCamera.test.ts`

**Interfaces:**
- Produces: `export interface OrbitBasis { right: [number, number, number]; forward0: [number, number, number] }` and `export function orbitBasisForUpAxis(upAxis: readonly [number, number, number]): OrbitBasis`. Later tasks (2, 4) both consume this.

- [ ] **Step 1: Write the failing tests**

Add to `packages/app/test/orbitCamera.test.ts`, right after the existing imports (keep the existing `import { describe, expect, it } from 'vitest'` and `OrbitCamera`-related imports as they are — this just adds `orbitBasisForUpAxis` to the import list):

```ts
import { describe, expect, it } from 'vitest'
import {
  EXPLORER_MIN_ORBIT_RADIUS,
  minOrbitRadiusForBlend,
  OrbitCamera,
  orbitBasisForUpAxis,
  REALISTIC_MIN_ORBIT_RADIUS,
} from '../src/camera/orbitCamera'
```

Add a new `describe` block anywhere at the top level of the file (e.g. right after the imports, before `describe('OrbitCamera', ...)`):

```ts
describe('orbitBasisForUpAxis', () => {
  it('uses world X as forward0 and world Y as right for the default up-axis (ecliptic north, +Z)', () => {
    const basis = orbitBasisForUpAxis([0, 0, 1])
    expect(basis.forward0[0]).toBeCloseTo(1, 10)
    expect(basis.forward0[1]).toBeCloseTo(0, 10)
    expect(basis.forward0[2]).toBeCloseTo(0, 10)
    expect(basis.right[0]).toBeCloseTo(0, 10)
    expect(basis.right[1]).toBeCloseTo(1, 10)
    expect(basis.right[2]).toBeCloseTo(0, 10)
  })

  it('falls back to world Y as the seed reference when up-axis is close to world X', () => {
    const basis = orbitBasisForUpAxis([1, 0, 0])
    expect(basis.forward0[0]).toBeCloseTo(0, 10)
    expect(basis.forward0[1]).toBeCloseTo(1, 10)
    expect(basis.forward0[2]).toBeCloseTo(0, 10)
    expect(basis.right[0]).toBeCloseTo(0, 10)
    expect(basis.right[1]).toBeCloseTo(0, 10)
    expect(basis.right[2]).toBeCloseTo(1, 10)
  })

  it('produces an orthonormal frame for an arbitrary tilted up-axis (Uranus\'s real pole)', () => {
    // Uranus's real pole direction (equatorialToEclipticPoleDirection(257.31, -15.18)) - the
    // steepest tilt of any body in this app, ~82 degrees from world Z, and close to world Y,
    // which is exactly why this is a meaningful case to exercise (see the design spec #3.1).
    const upAxis: [number, number, number] = [-0.212, -0.968, 0.1343]
    const basis = orbitBasisForUpAxis(upAxis)

    const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
    const length = (v: readonly number[]) => Math.hypot(v[0], v[1], v[2])

    expect(length(basis.forward0)).toBeCloseTo(1, 10)
    expect(length(basis.right)).toBeCloseTo(1, 10)
    expect(dot(basis.forward0, upAxis)).toBeCloseTo(0, 10)
    expect(dot(basis.right, upAxis)).toBeCloseTo(0, 10)
    expect(dot(basis.forward0, basis.right)).toBeCloseTo(0, 10)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/orbitCamera.test.ts`
Expected: FAIL — `orbitBasisForUpAxis is not a function` (or similar import error), since it doesn't exist yet.

- [ ] **Step 3: Implement `orbitBasisForUpAxis`**

In `packages/app/src/camera/orbitCamera.ts`, add this block after the existing `minOrbitRadiusForBlend` function and before `export interface OrbitCameraOptions`:

```ts
const REFERENCE_DEGENERACY_THRESHOLD = 0.999

function dot3(a: readonly [number, number, number], b: readonly [number, number, number]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function cross3(a: readonly [number, number, number], b: readonly [number, number, number]): [number, number, number] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

function normalize3(v: readonly [number, number, number]): [number, number, number] {
  const length = Math.hypot(v[0], v[1], v[2])
  return [v[0] / length, v[1] / length, v[2] / length]
}

export interface OrbitBasis {
  right: [number, number, number]
  forward0: [number, number, number]
}

// Builds an orthonormal (right, forward0) frame perpendicular to the given up-axis, so
// OrbitCamera can orbit around any axis (not just world Y) and defaultFramingAzimuth
// (cameraFollow.ts) can compute an azimuth relative to whatever's currently "up". forward0 is the
// azimuth=0 eye-offset direction; right is the azimuth=PI/2 direction (see getEyePosition below).
// World X is the primary Gram-Schmidt reference; world Y is the fallback for the rare case where
// upAxis is itself close to X (none of this app's 9 real body poles are - the largest X-component
// among them is Mars at 0.446 - but Uranus's real pole, [-0.212, -0.968, 0.134], sits close to
// world Y, which is exactly why Y isn't used as the PRIMARY reference: doing so would make the
// most steeply-tilted body in this app's data degenerate). See
// docs/superpowers/specs/2026-07-20-camera-north-up-orientation-design.md #3.1.
export function orbitBasisForUpAxis(upAxis: readonly [number, number, number]): OrbitBasis {
  const primaryReference: [number, number, number] = [1, 0, 0]
  const fallbackReference: [number, number, number] = [0, 1, 0]
  const reference =
    Math.abs(dot3(upAxis, primaryReference)) > REFERENCE_DEGENERACY_THRESHOLD ? fallbackReference : primaryReference
  const referenceDotUp = dot3(reference, upAxis)
  const forward0 = normalize3([
    reference[0] - referenceDotUp * upAxis[0],
    reference[1] - referenceDotUp * upAxis[1],
    reference[2] - referenceDotUp * upAxis[2],
  ])
  const right = normalize3(cross3(upAxis, forward0))
  return { right, forward0 }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/orbitCamera.test.ts`
Expected: PASS (all tests in the file, including the pre-existing ones — nothing else in the file changed yet).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/camera/orbitCamera.ts packages/app/test/orbitCamera.test.ts
git commit -m "$(cat <<'EOF'
Add orbitBasisForUpAxis: orthonormal frame for an arbitrary camera up-axis

Pure-math helper so OrbitCamera can orbit around any axis, not just
hardcoded world Y - the first step in rebasing the camera on the scene's
real ecliptic-north (world Z) instead of the mismatched Y-up convention
it's always used. See docs/superpowers/specs/2026-07-20-camera-north-up-orientation-design.md.
EOF
)"
```

---

### Task 2: Generalize `OrbitCamera` to orbit around `upAxis`

**Files:**
- Modify: `packages/app/src/camera/orbitCamera.ts`
- Test: `packages/app/test/orbitCamera.test.ts`

**Interfaces:**
- Consumes: `orbitBasisForUpAxis` from Task 1.
- Produces: `OrbitCamera.upAxis: vec3` (public field), `OrbitCameraOptions.upAxis?: [number, number, number]` (constructor option, defaults to `ECLIPTIC_NORTH`). Tasks 4 and 5 both read/write `orbitCamera.upAxis` and pass `upAxis` to the constructor.

- [ ] **Step 1: Write the failing tests (replacing 3 existing tests, whose expected values describe the old world-Y-up behavior)**

In `packages/app/test/orbitCamera.test.ts`, replace these three existing `it(...)` blocks inside `describe('OrbitCamera', ...)`:

```ts
  it('places the eye directly on the +Z axis at azimuth 0, elevation 0', () => {
    const camera = new OrbitCamera({ radius: 10, azimuth: 0, elevation: 0 })
    const eye = camera.getEyePosition()
    expect(eye[0]).toBeCloseTo(0, 10)
    expect(eye[1]).toBeCloseTo(0, 10)
    expect(eye[2]).toBeCloseTo(10, 10)
  })

  it('places the eye on the +X axis at azimuth PI/2, elevation 0', () => {
    const camera = new OrbitCamera({ radius: 10, azimuth: Math.PI / 2, elevation: 0 })
    const eye = camera.getEyePosition()
    expect(eye[0]).toBeCloseTo(10, 5)
    expect(eye[1]).toBeCloseTo(0, 10)
    expect(eye[2]).toBeCloseTo(0, 5)
  })

  it('raises the eye above the target as elevation increases', () => {
    const camera = new OrbitCamera({ radius: 10, azimuth: 0, elevation: Math.PI / 4 })
    const eye = camera.getEyePosition()
    expect(eye[1]).toBeCloseTo(10 * Math.sin(Math.PI / 4), 5)
  })
```

with:

```ts
  it('places the eye on the +X axis at azimuth 0, elevation 0 (default up-axis is ecliptic north, +Z)', () => {
    const camera = new OrbitCamera({ radius: 10, azimuth: 0, elevation: 0 })
    const eye = camera.getEyePosition()
    expect(eye[0]).toBeCloseTo(10, 10)
    expect(eye[1]).toBeCloseTo(0, 10)
    expect(eye[2]).toBeCloseTo(0, 10)
  })

  it('places the eye on the +Y axis at azimuth PI/2, elevation 0', () => {
    const camera = new OrbitCamera({ radius: 10, azimuth: Math.PI / 2, elevation: 0 })
    const eye = camera.getEyePosition()
    expect(eye[0]).toBeCloseTo(0, 5)
    expect(eye[1]).toBeCloseTo(10, 5)
    expect(eye[2]).toBeCloseTo(0, 10)
  })

  it('raises the eye above the target, along the up-axis, as elevation increases', () => {
    const camera = new OrbitCamera({ radius: 10, azimuth: 0, elevation: Math.PI / 4 })
    const eye = camera.getEyePosition()
    expect(eye[2]).toBeCloseTo(10 * Math.sin(Math.PI / 4), 5)
  })

  it('defaults upAxis to ecliptic north (+Z)', () => {
    const camera = new OrbitCamera()
    expect(camera.upAxis[0]).toBeCloseTo(0, 10)
    expect(camera.upAxis[1]).toBeCloseTo(0, 10)
    expect(camera.upAxis[2]).toBeCloseTo(1, 10)
  })

  it('accepts an explicit upAxis and orbits around it instead', () => {
    const camera = new OrbitCamera({ radius: 10, azimuth: 0, elevation: 0, upAxis: [0, 1, 0] })
    const eye = camera.getEyePosition()
    // upAxis=[0,1,0]: world X is already perpendicular to it, so orbitBasisForUpAxis's
    // Gram-Schmidt step leaves the primary reference (X) unchanged as forward0 - eye offset at
    // azimuth 0 lands on world X. (Not the same eye position the old hardcoded Y-up formula
    // produced at azimuth 0 - that formula always used Z as its azimuth-0 direction regardless of
    // which axis was "up"; this general version always seeds from X instead, except in the rare
    // degenerate case handled by the fallback reference - see the previous two tests.)
    expect(eye[0]).toBeCloseTo(10, 10)
    expect(eye[1]).toBeCloseTo(0, 10)
    expect(eye[2]).toBeCloseTo(0, 10)
  })
```

Leave the other existing tests (`'clamps elevation to avoid flipping past the poles'`, `'clamps radius to the configured min/max on zoom'`, `'produces a view matrix with 16 finite entries'`) exactly as they are — they don't depend on which axis is up.

- [ ] **Step 2: Run tests to verify the new/changed ones fail**

Run: `npx vitest run test/orbitCamera.test.ts`
Expected: FAIL on the rewritten eye-position tests (still using the old formula) and the two new tests (`upAxis` doesn't exist on `OrbitCamera` yet — TypeScript will actually fail to compile here, which is the expected "fails for the right reason": the feature doesn't exist yet).

- [ ] **Step 3: Generalize `OrbitCamera`**

In `packages/app/src/camera/orbitCamera.ts`:

Add this import at the top (alongside the existing `geometricBlend` import):

```ts
import { mat4, vec3 } from 'gl-matrix'
import { geometricBlend } from '../solarSystem/sceneScale'
import { ECLIPTIC_NORTH } from '../solarSystem/poleOrientation'
```

Add `upAxis` to the options interface:

```ts
export interface OrbitCameraOptions {
  target?: [number, number, number]
  radius?: number
  azimuth?: number
  elevation?: number
  minRadius?: number
  maxRadius?: number
  upAxis?: [number, number, number]
}
```

Replace the whole `OrbitCamera` class (keep `MAX_ELEVATION`/`clamp` above it unchanged) with:

```ts
// Orbits around `target` at a fixed distance (`radius`), parameterized by azimuth (rotation
// around `upAxis`) and elevation (angle above the plane perpendicular to `upAxis`). `upAxis`
// defaults to ECLIPTIC_NORTH, the scene's real "north" (see poleOrientation.ts) - not world Y,
// which doesn't correspond to anything astronomical. CameraFollowController re-points upAxis at a
// followed entity's own real pole direction during fly-to (see cameraFollow.ts). See
// docs/superpowers/specs/2026-07-20-camera-north-up-orientation-design.md for why this matters.
export class OrbitCamera {
  target: vec3
  radius: number
  azimuth: number
  elevation: number
  minRadius: number
  maxRadius: number
  upAxis: vec3

  constructor(options: OrbitCameraOptions = {}) {
    this.target = vec3.fromValues(...(options.target ?? [0, 0, 0]))
    this.radius = options.radius ?? 65
    this.azimuth = options.azimuth ?? 0
    this.elevation = options.elevation ?? 0.4
    this.minRadius = options.minRadius ?? 5
    this.maxRadius = options.maxRadius ?? 700
    this.upAxis = vec3.fromValues(...(options.upAxis ?? ECLIPTIC_NORTH))
  }

  getEyePosition(): vec3 {
    const cosEl = Math.cos(this.elevation)
    const sinEl = Math.sin(this.elevation)
    const sinAz = Math.sin(this.azimuth)
    const cosAz = Math.cos(this.azimuth)
    const upAxis: [number, number, number] = [this.upAxis[0], this.upAxis[1], this.upAxis[2]]
    const { right, forward0 } = orbitBasisForUpAxis(upAxis)
    const x = this.target[0] + this.radius * (cosEl * (sinAz * right[0] + cosAz * forward0[0]) + sinEl * upAxis[0])
    const y = this.target[1] + this.radius * (cosEl * (sinAz * right[1] + cosAz * forward0[1]) + sinEl * upAxis[1])
    const z = this.target[2] + this.radius * (cosEl * (sinAz * right[2] + cosAz * forward0[2]) + sinEl * upAxis[2])
    return vec3.fromValues(x, y, z)
  }

  getViewMatrix(): mat4 {
    return mat4.lookAt(mat4.create(), this.getEyePosition(), this.target, this.upAxis)
  }

  applyDrag(deltaX: number, deltaY: number, sensitivity = 0.005): void {
    this.azimuth -= deltaX * sensitivity
    this.elevation = clamp(this.elevation + deltaY * sensitivity, -MAX_ELEVATION, MAX_ELEVATION)
  }

  applyZoom(deltaY: number, sensitivity = 0.001): void {
    this.radius = clamp(this.radius * (1 + deltaY * sensitivity), this.minRadius, this.maxRadius)
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/orbitCamera.test.ts`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output. (This will surface any other file that constructs `mat4.lookAt`/reads `orbitCamera` in a way that assumed the old shape — there shouldn't be any outside `cameraFollow.ts` and `main.ts`, both handled in later tasks, but check the output carefully.)

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/camera/orbitCamera.ts packages/app/test/orbitCamera.test.ts
git commit -m "$(cat <<'EOF'
Rebase OrbitCamera on ecliptic north (world Z) instead of world Y

OrbitCamera has always orbited/rendered "up" relative to world Y, but the
scene's real ecliptic plane is X/Y with Z as true north (verified against
the running app's actual body positions/pole data - see the design spec).
It only looked right by coincidence at azimuth 0. upAxis now defaults to
ECLIPTIC_NORTH and getEyePosition/getViewMatrix build a proper orthonormal
frame from it via orbitBasisForUpAxis, instead of hardcoded world axes.
EOF
)"
```

---

### Task 3: `entityPoleDirection` in `entities.ts`

**Files:**
- Modify: `packages/app/src/solarSystem/entities.ts`
- Test: `packages/app/test/entities.test.ts`

**Interfaces:**
- Produces: `export function entityPoleDirection(entity: SolarSystemEntity): [number, number, number]`. Task 4 consumes this.

- [ ] **Step 1: Write the failing tests**

In `packages/app/test/entities.test.ts`, add `equatorialToEclipticPoleDirection` to the existing `moonOrbit` import line and add `entityPoleDirection` to the existing `entities` import:

```ts
import { describe, expect, it } from 'vitest'
import {
  ALL_ENTITIES,
  entityPoleDirection,
  entityWorldPosition,
  matchesSearchQuery,
  planetAuPosition,
  searchEntities,
  type SolarSystemEntity,
} from '../src/solarSystem/entities'
import { AU_KM, PLANETS } from '../src/solarSystem/bodies'
import { MOONS } from '../src/solarSystem/moons'
import { scaledPosition } from '../src/solarSystem/sceneScale'
import { moonOrbitAngleRadians, moonOrbitReferencePoleDirection, moonRelativePosition, scaledMoonOrbitRadiusUnits } from '../src/solarSystem/moonOrbit'
import { equatorialToEclipticPoleDirection } from '../src/solarSystem/poleOrientation'
```

Add a new `describe` block at the end of the file:

```ts
describe('entityPoleDirection', () => {
  it('matches equatorialToEclipticPoleDirection for a planet', () => {
    const mars = findEntity('mars')
    const body = mars.definition as (typeof PLANETS)[number]
    const expected = equatorialToEclipticPoleDirection(body.poleRightAscensionDegrees, body.poleDeclinationDegrees)
    expect(entityPoleDirection(mars)).toEqual(expected)
  })

  it('matches equatorialToEclipticPoleDirection for the Sun', () => {
    const sun = findEntity('sun')
    const body = sun.definition as (typeof PLANETS)[number]
    const expected = equatorialToEclipticPoleDirection(body.poleRightAscensionDegrees, body.poleDeclinationDegrees)
    expect(entityPoleDirection(sun)).toEqual(expected)
  })

  it('matches moonOrbitReferencePoleDirection for a moon', () => {
    const titan = findEntity('titan')
    const saturn = findEntity('saturn')
    const moon = titan.definition as (typeof MOONS)[number]
    const expected = moonOrbitReferencePoleDirection(moon, saturn.definition as (typeof PLANETS)[number])
    expect(entityPoleDirection(titan)).toEqual(expected)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/entities.test.ts`
Expected: FAIL — `entityPoleDirection` is not exported from `entities.ts` yet.

- [ ] **Step 3: Implement `entityPoleDirection`**

In `packages/app/src/solarSystem/entities.ts`, add `equatorialToEclipticPoleDirection` to the existing `moonOrbit` import and add a new import for it:

```ts
import { sphericalToX, sphericalToY, sphericalToZ } from '@toboldlyglow/engine'
import { PLANETS, SUN, type BodyDefinition } from './bodies'
import { MOONS, type MoonDefinition } from './moons'
import { scaledPosition } from './sceneScale'
import { AU_KM } from './bodies'
import { moonOrbitAngleRadians, moonOrbitReferencePoleDirection, moonRelativePosition, scaledMoonOrbitRadiusUnits } from './moonOrbit'
import { equatorialToEclipticPoleDirection } from './poleOrientation'
```

Add this function at the end of the file (after `entityWorldPosition`):

```ts
// An entity's own real north-pole direction - the same value already used to tilt its rendered
// mesh (see main.ts's use of equatorialToEclipticPoleDirection for the Sun/planets and
// moonOrbitReferencePoleDirection for moons). Used by CameraFollowController to orient the camera
// to a followed entity's real "up" instead of the scene's generic ecliptic north.
export function entityPoleDirection(entity: SolarSystemEntity): [number, number, number] {
  if (entity.kind === 'moon') {
    const moon = entity.definition as MoonDefinition
    const parent = ALL_ENTITIES.find((e) => e.id === moon.parentId)
    if (!parent) throw new Error(`${moon.id} has no known parent ${moon.parentId}.`)
    return moonOrbitReferencePoleDirection(moon, parent.definition as BodyDefinition)
  }
  const body = entity.definition as BodyDefinition
  return equatorialToEclipticPoleDirection(body.poleRightAscensionDegrees, body.poleDeclinationDegrees)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/entities.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/solarSystem/entities.ts packages/app/test/entities.test.ts
git commit -m "$(cat <<'EOF'
Add entityPoleDirection: an entity's real pole, keyed by kind

Straight dispatch to the two functions main.ts already calls to tilt each
entity's own rendered mesh (equatorialToEclipticPoleDirection for Sun/
planets, moonOrbitReferencePoleDirection for moons) - exposed once per
entity so CameraFollowController can reuse the same data for camera
orientation (next task) instead of duplicating the dispatch logic.
EOF
)"
```

---

### Task 4: Generalize `defaultFramingAzimuth` and tween `upAxis` in `CameraFollowController`

**Files:**
- Modify: `packages/app/src/camera/cameraFollow.ts`
- Test: `packages/app/test/cameraFollow.test.ts`

**Interfaces:**
- Consumes: `orbitBasisForUpAxis`, `OrbitBasis` (Task 1/2, from `./orbitCamera`); `entityPoleDirection` (Task 3, from `../solarSystem/entities`).
- Produces: `defaultFramingAzimuth(targetPosition, fallbackAzimuth, basis: OrbitBasis): number` (signature changed - now takes a third argument). `CameraFollowController` now also sets `orbitCamera.upAxis` during fly-to.

- [ ] **Step 1: Write the failing tests**

In `packages/app/test/cameraFollow.test.ts`, add `orbitBasisForUpAxis` to the existing `OrbitCamera` import:

```ts
import { describe, expect, it } from 'vitest'
import { OrbitCamera, orbitBasisForUpAxis } from '../src/camera/orbitCamera'
import { CameraFollowController, defaultFramingAzimuth } from '../src/camera/cameraFollow'
import { ALL_ENTITIES, entityPoleDirection, entityWorldPosition } from '../src/solarSystem/entities'
```

Replace the existing `describe('defaultFramingAzimuth', ...)` block:

```ts
describe('defaultFramingAzimuth', () => {
  it('faces the eye offset toward the Sun-relative direction for a target on the +X axis', () => {
    const basis = orbitBasisForUpAxis([0, 0, 1]) // default up-axis, ecliptic north
    const azimuth = defaultFramingAzimuth([10, 0, 0], 99, basis)
    expect(Math.sin(azimuth)).toBeCloseTo(0, 10)
    expect(Math.cos(azimuth)).toBeCloseTo(-1, 10)
  })

  it('faces the eye offset toward the Sun-relative direction for a target on the +Y axis', () => {
    const basis = orbitBasisForUpAxis([0, 0, 1])
    const azimuth = defaultFramingAzimuth([0, 5, 0], 99, basis)
    expect(Math.sin(azimuth)).toBeCloseTo(-1, 10)
    expect(Math.cos(azimuth)).toBeCloseTo(0, 10)
  })

  it('falls back to the given azimuth when the target is at the origin (the Sun itself)', () => {
    const basis = orbitBasisForUpAxis([0, 0, 1])
    expect(defaultFramingAzimuth([0, 0, 0], 1.234, basis)).toBe(1.234)
  })
})
```

Replace the test `'reorients azimuth toward the target during the fly-to, so the view direction actually changes'`:

```ts
  it('reorients azimuth toward the target during the fly-to, so the view direction actually changes', () => {
    const camera = new OrbitCamera({ azimuth: 0 })
    const controller = new CameraFollowController(camera)
    const earth = findEntity('earth')
    const T = 0.1
    const daysSinceEpoch = 500
    const scaleBlend = 0.5

    controller.selectEntity(earth, T, daysSinceEpoch, scaleBlend)
    runPastFlyTo(controller, T, daysSinceEpoch, scaleBlend)

    const expectedTarget = entityWorldPosition(earth, T, daysSinceEpoch, scaleBlend)
    const basis = orbitBasisForUpAxis([0, 0, 1]) // camera's up-axis before this fly-to started
    const expectedAzimuth = defaultFramingAzimuth(expectedTarget, 0, basis)
    expect(Math.sin(camera.azimuth)).toBeCloseTo(Math.sin(expectedAzimuth), 6)
    expect(Math.cos(camera.azimuth)).toBeCloseTo(Math.cos(expectedAzimuth), 6)
  })
```

Add two new tests inside `describe('CameraFollowController', ...)`, anywhere after the existing tests:

```ts
  it("orients the camera's up-axis to the followed entity's own pole after the fly-to", () => {
    const camera = new OrbitCamera()
    const controller = new CameraFollowController(camera)
    const earth = findEntity('earth')

    controller.selectEntity(earth, 0.1, 500, 0.5)
    runPastFlyTo(controller, 0.1, 500, 0.5)

    const expectedPole = entityPoleDirection(earth)
    expect(camera.upAxis[0]).toBeCloseTo(expectedPole[0], 6)
    expect(camera.upAxis[1]).toBeCloseTo(expectedPole[1], 6)
    expect(camera.upAxis[2]).toBeCloseTo(expectedPole[2], 6)
  })

  it('leaves the up-axis wherever it was after stopFollowing, matching target/radius/azimuth', () => {
    const camera = new OrbitCamera()
    const controller = new CameraFollowController(camera)
    const earth = findEntity('earth')

    controller.selectEntity(earth, 0.1, 500, 0.5)
    runPastFlyTo(controller, 0.1, 500, 0.5)

    const upAxisAfterFlyTo: [number, number, number] = [camera.upAxis[0], camera.upAxis[1], camera.upAxis[2]]
    controller.stopFollowing()

    expect(camera.upAxis[0]).toBe(upAxisAfterFlyTo[0])
    expect(camera.upAxis[1]).toBe(upAxisAfterFlyTo[1])
    expect(camera.upAxis[2]).toBe(upAxisAfterFlyTo[2])
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/cameraFollow.test.ts`
Expected: FAIL — `defaultFramingAzimuth` called with 3 args where it currently only accepts 2 (TypeScript compile error, the expected "fails for the right reason" here), and `camera.upAxis`/`entityPoleDirection` don't exist/aren't wired up yet.

- [ ] **Step 3: Implement**

Replace the entire contents of `packages/app/src/camera/cameraFollow.ts` with:

```ts
import { vec3 } from 'gl-matrix'
import { AU_KM } from '../solarSystem/bodies'
import { entityPoleDirection, entityWorldPosition, type SolarSystemEntity } from '../solarSystem/entities'
import { scaledBodyRadiusUnits } from '../solarSystem/sceneScale'
import { orbitBasisForUpAxis, type OrbitBasis, type OrbitCamera } from './orbitCamera'
import { easeInOutCubic, lerp, lerpAngle, lerpVec3 } from './easing'

export interface CameraFollowOptions {
  flyToDurationSeconds?: number
}

// How many body-radii away the default fly-to framing sits, so small moons get a close-up view
// and large bodies (the Sun, Jupiter) get a farther one, all clamped to the camera's own zoom range.
const FRAMING_RADIUS_MULTIPLIER = 6

// Controls how quickly the locked-on camera eases toward a followed entity's live position each
// frame, rather than snapping to it exactly. Framerate-independent exponential smoothing (see
// followSmoothingFactor) - closes ~95% of the gap within about 0.3 real seconds at this rate.
// Needed because a fast-orbiting moon under time acceleration can move a large distance between
// frames; snapping straight to its exact position every frame whips the camera through that same
// fast motion, which reads as chaotic rather than as smooth tracking.
const FOLLOW_SMOOTHING_RATE = 10

// Fraction of the remaining gap to a target value to close within `deltaSeconds` of real time,
// independent of frame rate (unlike a fixed per-frame lerp factor, which would converge slower on
// slower frame rates and faster on faster ones for the same nominal factor).
function followSmoothingFactor(deltaSeconds: number): number {
  return 1 - Math.exp(-FOLLOW_SMOOTHING_RATE * deltaSeconds)
}

interface FlyToTween {
  startTarget: [number, number, number]
  startRadius: number
  startAzimuth: number
  startUpAxis: [number, number, number]
  endTarget: [number, number, number]
  endRadius: number
  endAzimuth: number
  endUpAxis: [number, number, number]
  elapsedSeconds: number
  durationSeconds: number
}

function defaultFramingRadius(entity: SolarSystemEntity, scaleBlend: number, camera: OrbitCamera): number {
  const { radiusKm, explorerVisualRadius } = entity.definition
  const bodyRadius = scaledBodyRadiusUnits(radiusKm, explorerVisualRadius, scaleBlend, AU_KM)
  const framing = bodyRadius * FRAMING_RADIUS_MULTIPLIER
  return Math.min(Math.max(framing, camera.minRadius), camera.maxRadius)
}

// Azimuth (horizontal facing direction, relative to the given up-axis basis) that positions the
// camera's eye roughly on the Sun's side of the target, so the flight ends looking at a sunlit
// face rather than a silhouette. Only reorients azimuth, not elevation - elevation stays whatever
// the user had. Falls back to the given azimuth when the target is at the origin (the Sun
// itself), where there's no meaningful "direction toward the Sun" to face. `basis` must be the
// (right, forward0) frame for whichever up-axis is in effect when this is called - see
// orbitBasisForUpAxis in orbitCamera.ts.
export function defaultFramingAzimuth(
  targetPosition: readonly [number, number, number],
  fallbackAzimuth: number,
  basis: OrbitBasis,
): number {
  const [tx, ty, tz] = targetPosition
  if (Math.hypot(tx, ty, tz) < 1e-9) return fallbackAzimuth
  const toEye: [number, number, number] = [-tx, -ty, -tz]
  const rightComponent = toEye[0] * basis.right[0] + toEye[1] * basis.right[1] + toEye[2] * basis.right[2]
  const forwardComponent = toEye[0] * basis.forward0[0] + toEye[1] * basis.forward0[1] + toEye[2] * basis.forward0[2]
  return Math.atan2(rightComponent, forwardComponent)
}

// Flies the camera to a selected entity, then keeps OrbitCamera.target locked onto its live world
// position every frame - as it moves along its orbit and/or spins - without touching
// azimuth/elevation/radius, so manual drag/zoom keep working normally around the moving target.
export class CameraFollowController {
  followedEntityId: string | null = null
  private followedEntity: SolarSystemEntity | null = null
  private flyTo: FlyToTween | null = null
  private readonly flyToDurationSeconds: number

  constructor(
    private readonly orbitCamera: OrbitCamera,
    options: CameraFollowOptions = {},
  ) {
    this.flyToDurationSeconds = options.flyToDurationSeconds ?? 1.5
  }

  selectEntity(entity: SolarSystemEntity, T: number, daysSinceEpoch: number, scaleBlend: number): void {
    const startTarget: [number, number, number] = [
      this.orbitCamera.target[0],
      this.orbitCamera.target[1],
      this.orbitCamera.target[2],
    ]
    const startUpAxis: [number, number, number] = [
      this.orbitCamera.upAxis[0],
      this.orbitCamera.upAxis[1],
      this.orbitCamera.upAxis[2],
    ]
    this.followedEntity = entity
    this.followedEntityId = entity.id
    const endTarget = entityWorldPosition(entity, T, daysSinceEpoch, scaleBlend)
    const basis = orbitBasisForUpAxis(startUpAxis)
    this.flyTo = {
      startTarget,
      startRadius: this.orbitCamera.radius,
      startAzimuth: this.orbitCamera.azimuth,
      startUpAxis,
      endTarget,
      endRadius: defaultFramingRadius(entity, scaleBlend, this.orbitCamera),
      endAzimuth: defaultFramingAzimuth(endTarget, this.orbitCamera.azimuth, basis),
      endUpAxis: entityPoleDirection(entity),
      elapsedSeconds: 0,
      durationSeconds: this.flyToDurationSeconds,
    }
  }

  stopFollowing(): void {
    this.followedEntityId = null
    this.followedEntity = null
    this.flyTo = null
  }

  update(deltaSeconds: number, T: number, daysSinceEpoch: number, scaleBlend: number): void {
    if (this.flyTo) {
      this.flyTo.elapsedSeconds += deltaSeconds
      const t = Math.min(this.flyTo.elapsedSeconds / this.flyTo.durationSeconds, 1)
      const eased = easeInOutCubic(t)
      vec3.copy(this.orbitCamera.target, lerpVec3(this.flyTo.startTarget, this.flyTo.endTarget, eased))
      this.orbitCamera.radius = lerp(this.flyTo.startRadius, this.flyTo.endRadius, eased)
      this.orbitCamera.azimuth = lerpAngle(this.flyTo.startAzimuth, this.flyTo.endAzimuth, eased)
      const upAxis = lerpVec3(this.flyTo.startUpAxis, this.flyTo.endUpAxis, eased)
      const upAxisLength = Math.hypot(upAxis[0], upAxis[1], upAxis[2])
      vec3.set(this.orbitCamera.upAxis, upAxis[0] / upAxisLength, upAxis[1] / upAxisLength, upAxis[2] / upAxisLength)
      if (t >= 1) this.flyTo = null
      return
    }

    if (this.followedEntity) {
      const livePosition = entityWorldPosition(this.followedEntity, T, daysSinceEpoch, scaleBlend)
      const currentTarget: [number, number, number] = [
        this.orbitCamera.target[0],
        this.orbitCamera.target[1],
        this.orbitCamera.target[2],
      ]
      vec3.copy(this.orbitCamera.target, lerpVec3(currentTarget, livePosition, followSmoothingFactor(deltaSeconds)))
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/cameraFollow.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/camera/cameraFollow.ts packages/app/test/cameraFollow.test.ts
git commit -m "$(cat <<'EOF'
Orient the camera to a followed entity's real pole during fly-to

defaultFramingAzimuth now resolves its angle against whatever up-axis
basis is currently in effect, instead of a hardcoded world X/Z plane.
CameraFollowController tweens orbitCamera.upAxis toward the followed
entity's own real pole (entityPoleDirection) alongside the existing
target/radius/azimuth tween, so e.g. Earth's actual north reads
top-of-screen when followed, instead of the scene's generic ecliptic
north or an arbitrary direction.
EOF
)"
```

---

### Task 5: Re-tune `main.ts`'s default camera parameters

**Files:**
- Modify: `packages/app/src/main.ts:288`

**Interfaces:**
- Consumes: `OrbitCamera` (Task 2) — no new exports from this task.

- [ ] **Step 1: Update the initial `OrbitCamera` construction**

In `packages/app/src/main.ts`, replace line 288:

```ts
  const orbitCamera = new OrbitCamera({ radius: 65, azimuth: 0, elevation: 0.4 })
```

with:

```ts
  // elevation was 0.4 rad under the old (incorrect) Y-up convention, where azimuth=0 happened to
  // put most of the eye offset along the scene's real north (Z) by coincidence of the old
  // hardcoded formula - see docs/superpowers/specs/2026-07-20-camera-north-up-orientation-design.md
  // #1 and #3.2. That accidental view sat ~23 degrees off true north, i.e. ~67 degrees of true
  // elevation above the real ecliptic plane. Now that elevation is measured against the real
  // up-axis (ECLIPTIC_NORTH by default), 67 degrees reproduces the same-looking default view
  // under the corrected semantics.
  const orbitCamera = new OrbitCamera({ radius: 65, azimuth: 0, elevation: (67 * Math.PI) / 180 })
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Run the full test suite**

Run: `npx vitest run`
Expected: PASS, all test files (main.ts has no dedicated test file - it's the app entry point, exercised via the browser check in Task 6).

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/main.ts
git commit -m "$(cat <<'EOF'
Re-tune the default camera elevation for the corrected up-axis convention

The old elevation=0.4 rad only produced a reasonable default view because
azimuth=0's eye offset happened to land on the scene's real north (Z) by
coincidence of the previous, incorrect Y-up formula. Now that elevation is
measured against the real up-axis, 67 degrees reproduces the same
effective viewing angle under the corrected semantics (see
docs/superpowers/specs/2026-07-20-camera-north-up-orientation-design.md #3.2).
EOF
)"
```

---

### Task 6: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Full test suite**

Run: `npx vitest run`
Expected: all test files pass (137+ tests from before this plan, plus the new ones added in Tasks 1, 2, 3, 4).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Manual browser verification**

Start the dev server: `npx vite --port 5183` (run in background or a separate terminal).

In a browser (or via the `claude-in-chrome` tools), navigate to `http://localhost:5183/`:

1. **Unfollowed default view**: confirm the initial view still looks like a sensible 3/4 view of the solar system (Sun with visible orbit rings, planets spread across the view) — not a flat edge-on line and not a straight-down top-down view. This confirms the re-tuned `elevation` (Task 5) actually reproduces a reasonable default.
2. **Drag all the way around**: click-drag horizontally through a full rotation. Confirm the view stays roughly at a consistent height above the ecliptic disk throughout (no longer tips into an edge-on view partway through, which was the deeper bug described in the design spec §1).
3. **Follow Earth at Realistic scale**: set the scale slider to 0 ("Realistic"), search for and select "Earth". Confirm recognizable geography (coastlines, ice caps) reads with north at the top of the screen, not sideways — this is the original reported bug.
4. **Follow Uranus**: search for and select "Uranus" (any scale). Confirm the view doesn't look eye-position/roll-mismatched (e.g. the planet floating oddly relative to where the camera appears to be) — this is the case Task 1's fallback-reference logic specifically protects against.
5. Stop the dev server when done.

- [ ] **Step 4: Report results**

If all three manual checks look correct, this plan is complete. If step 3.1 (default view) doesn't look reasonable, the `elevation` constant from Task 5 needs adjusting - re-derive by trial in the browser (the 67-degree starting value is explicitly documented as an approximation, not a first-principles-exact pick) and re-commit that one line.
