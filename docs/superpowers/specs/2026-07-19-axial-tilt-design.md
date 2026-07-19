# Axial Tilt & Rotation-Axis Correctness — Design Specification

Status: Approved — 2026-07-19

## 1. Motivation

No body in the renderer has a real rotation axis today. Every Sun/planet/moon spins via
`mat4.fromYRotation(rotation)` (`main.ts:507, 563, 617`) — rotation around the scene's Y axis.
But the engine's coordinate convention (`packages/engine/assembly/coordinates.ts`) puts each
planet's orbital (ecliptic) plane in the scene's **X/Y plane** (`sphericalToX`/`sphericalToY` both
carry `cos(latitude)`, the in-plane factor; `sphericalToZ` carries `sin(latitude)`, the small
out-of-plane wobble). Spinning around scene-Y therefore spins every body around an axis that lies
**inside its own orbital plane**, not roughly perpendicular to it — a full 90° error, not merely a
missing few degrees of tilt. Visually this is "beads on a string, spinning around the thread"
rather than a normal upright spin.

Confirmed downstream symptoms of this same root gap:
- Uranus's real ~97.8° obliquity (it rotates almost on its side) isn't modeled at all; only its
  retrograde *direction* is faked via a negative `siderealRotationHours` sign.
- Saturn's ring is given a hardcoded 26.73° tilt (`main.ts`, near the ring-mesh code) as a one-off
  special case, because there's no general per-body tilt system for the sphere itself to share.
- Moons orbit in a fixed, always-flat scene plane unrelated to their parent's real equatorial
  plane. The largest visible discrepancies: Titan (~27° off, Saturn's equator vs. today's flat
  orbit), Titania/Oberon (should be near-polar around Uranus, ~98° off), Triton (~157°-inclined
  retrograde around Neptune, currently a simple flat retrograde circle).
- (Separately diagnosed and already fixed: moons' *own* spin sign relative to their orbital angle
  was backwards, breaking tidal lock — see `moonOrbit.ts`'s `moonRotationAngleRadians`. That fix
  stands independent of this spec, but this spec's tilt-then-spin composition is where moon
  rotation gets re-touched next, so it's called out here to avoid re-deriving it.)

## 2. Scope

**In scope**: real axial tilt (magnitude + 3D direction) for the Sun and all 8 planets; real
orbital-plane orientation (relative to the parent's tilted equator) for all 9 moons; unifying
Saturn's ring tilt with the sphere's own tilt. The existing retrograde sign convention
(`siderealRotationHours` negative = retrograde) is kept as-is, independent of the new tilt data —
see §3 for why it can't be folded into tilt magnitude alone.

**Out of scope**:
- **Precession.** Real axial precession (Earth's ~26,000-year wobble, and similar for other
  bodies) is irrelevant at the timescales this app's time controller reaches (fastest preset is 1
  year/s) and is not modeled. Pole direction is treated as fixed at its J2000 value for all
  simulated dates.
- **Per-body prime-meridian alignment.** Which exact surface meridian faces a particular direction
  at a particular time is not modeled or sourced; textures are not calibrated against real surface
  feature positions. Only the *axis orientation* (which way "up" points) and *rotation rate/sign*
  are in scope, not "which crater faces which direction at time T."
- **Moon axial tilt independent of orbital plane.** Tidally locked moons' own spin already reduces
  to their orbital motion (see the tidal-lock fix). This spec only adds each moon's *orbital-plane*
  orientation relative to its parent's equator; it does not add a separate, independent moon
  "obliquity" concept.
- **Lunar nodal precession.** The real Moon's orbital plane precesses relative to the *ecliptic*
  with an ~18.6-year period (driven by solar perturbation), causing its inclination to Earth's
  equator to oscillate between ~18.3° and ~28.6° over that cycle — unlike the other 8 moons in
  this set, whose orbital planes are genuinely locked to their parent's equatorial bulge and don't
  have this behavior. Modeling that precession is out of scope (per the precession exclusion
  above), so the Moon is a **documented special case**: its orbital plane is built directly from
  its ecliptic-relative inclination (~5.145°, the real, non-precessing quantity) rather than
  composed with Earth's own pole direction the way the other 8 moons are. This is more accurate
  than forcing it through the same parent-equator composition, not less — the Moon's orbit isn't
  actually locked to Earth's equator in reality.

## 3. Reference frame & rotation composition

- **Ecliptic-north = scene-Z.** This is the axis the engine's `sphericalToZ`/latitude already maps
  onto, and is the natural "default, zero-tilt" pole direction for any body.
- **Pole direction source**: each body's real north-pole right ascension (α₀) and declination (δ₀)
  — equatorial/ICRF/J2000 coordinates, as published by the IAU Working Group on Cartographic
  Coordinates and Rotational Elements (WGCCRE) — converted to ecliptic longitude/latitude via a
  fixed rotation by Earth's obliquity of the ecliptic (ε ≈ 23.4393°, J2000). This ecliptic
  longitude/latitude pair, run through the same `sphericalToX/Y/Z`-style formula already used for
  positions, yields a **pole direction unit vector in scene coordinates**.
- **Per-body world matrix**: `world = translate(scenePosition) · tiltRotation · spin(dailyAngle
  around local Z) · scale`. `tiltRotation` is the minimal rotation mapping local +Z onto the body's
  real pole direction (axis = `cross(+Z, poleDir)`, angle = `acos(dot(+Z, poleDir))`) — spin the
  sphere about its own polar axis first (while still aligned with Z), then tilt the whole
  already-spinning sphere so its pole points the real direction.
- **Retrograde stays a genuine, independent sign — this does *not* fall out of tilt magnitude
  alone.** Earlier drafts of this design assumed a pole direction more than 90° from
  ecliptic-north would always produce the "spins backwards" appearance, letting the existing
  negative-`siderealRotationHours` convention be removed. That assumption is wrong: it holds for
  Venus (derived tilt ≈178.5°, unambiguous), but not for Uranus. IAU's officially-published pole
  for Uranus (RA 257.31°, Dec −15.18°) uses the "invariable-plane-north" convention, which derives
  a tilt of **≈82°** — under 90° — even though Uranus's rotation is genuinely retrograde relative
  to that specific pole. (The commonly-quoted "~97.8°" figure describes the *same* physical axis
  under the *other* valid convention — right-hand-rule prograde — not a different fact; 82° and
  97.8° are supplementary angles for the same axis.) Since IAU's own published values don't
  reliably encode rotation direction via tilt-magnitude alone, `siderealRotationHours` **keeps its
  existing signed convention** (negative = retrograde), independent of and layered on top of the
  new pole-direction/tilt system. Tilt determines *orientation*; sign determines *spin direction*
  — they are separate facts, not one deriving the other.
- **Saturn's ring** adopts the same `tiltRotation` as Saturn's own sphere, replacing today's
  independent hardcoded 26.73° special case.

## 4. Data model

- **`solarSystem/bodies.ts`**: `BodyDefinition` gains `poleRightAscensionDegrees: number` and
  `poleDeclinationDegrees: number` (IAU WGCCRE-sourced, J2000 epoch, used exactly as published —
  no convention-flipping). `siderealRotationHours` keeps its existing signed convention (negative
  = retrograde) unchanged — see §3's retrograde note.
- **`solarSystem/moons.ts`**: `MoonDefinition` gains `orbitInclinationToParentEquatorDegrees:
  number` and `orbitAscendingNodeDegrees: number` — real orbital elements describing the moon's
  orbital-plane tilt relative to its parent's equatorial plane (near-zero for the regular moons;
  large for Triton).
- **New module `solarSystem/poleOrientation.ts`** (pure, unit-testable):
  - `equatorialToEclipticPoleDirection(raDegrees, decDegrees): [number, number, number]` — the
    RA/Dec → ecliptic-frame conversion described in §3.
  - `axisAlignmentRotation(poleDirection): mat4` — the "rotate local +Z onto this direction" matrix
    described in §3.
- **Moon orbital-plane normal** = parent's pole direction, further rotated by the moon's own
  `orbitInclinationToParentEquatorDegrees`/`orbitAscendingNodeDegrees`. A moon's position becomes:
  a flat circle in its *local* orbital plane (radius, angle), rotated by that plane's orientation,
  translated to the parent's position — replacing today's always-flat `(x, 0, z)` computation in
  `moonOrbit.ts`/`main.ts`.
- **Exception: the Moon** (see §2's lunar-precession note). Its orbital-plane normal is built from
  ecliptic-north tilted by its own `orbitInclinationToParentEquatorDegrees` directly — *not*
  composed with Earth's pole direction — since its real orbital plane precesses relative to the
  ecliptic, not relative to Earth's equator. The field name stays the same for interface
  consistency across `MOONS`; only the Moon's composition step skips the parent-pole step.
- **Ascending-node precision**: for the 8 moons whose real inclination-to-equator is under half a
  degree (every moon except Triton), the ascending node has no visually perceptible effect and is
  set to 0° as a documented simplification. Triton's ascending node genuinely matters (its ~157°
  inclination is large) but the real value precesses with a ~678-year period and isn't a fixed
  constant; since precession is out of scope, a single illustrative snapshot value is used and
  documented as such, not presented as an unchanging precise constant.

## 5. Rendering changes (file-level)

- `main.ts`: Sun/planet world-matrix construction (currently `fromYRotation` at lines 507, 563)
  becomes `axisAlignmentRotation(poleDir) · fromZRotation(rotation)`. Saturn's ring-tilt special
  case is removed in favor of reusing Saturn's own `tiltRotation`. Moon world-matrix construction
  (line 617) is rebuilt on the new orbital-plane-normal composition from §4.
- `solarSystem/moonOrbit.ts`: orbital-plane composition helpers added alongside the existing
  angle/position functions; the already-fixed `moonRotationAngleRadians` sign is preserved as-is.
- `solarSystem/poleOrientation.ts` (new, per §4).

## 6. Testing

- Unit tests for `equatorialToEclipticPoleDirection` against known reference cases (e.g. Earth's
  pole direction should land very close to true ecliptic-north, given Earth's real RA/Dec and the
  obliquity constant relate that way by definition) and for `axisAlignmentRotation` (maps +Z onto
  the given direction exactly; is a proper rotation — orthogonal, determinant 1).
- Updated `rotation.ts`/`moonOrbit.ts` tests reflecting the new Z-based spin-then-tilt convention.
- A geometric test proving Uranus's real pole direction (derived from its IAU-published RA/Dec)
  lies close to its own orbital plane rather than close to upright — i.e. its derived tilt from
  ecliptic-north is close to 90° (concretely, IAU's published pole gives ≈82°; the assertion is
  written to hold regardless of which of the two valid "north pole" conventions a value uses,
  since they're supplementary angles for the same physical axis — see §3).
- A geometric test proving Titania/Oberon's orbital-plane normal ends up close to Uranus's own
  pole direction (near-polar relative to the ecliptic), and Triton's ends up steeply inclined and
  retrograde relative to Neptune's.
- Existing e2e suites (`solarSystem.spec.ts`, `moonsAndFlares.spec.ts`, etc.) as regression
  coverage — no new interactive behavior is introduced, only rendering correctness.

## 7. Data provenance

Real IAU WGCCRE pole RA/Dec values and moon orbital elements (inclination-to-equator, ascending
node) are sourced and verified against the published IAU WGCCRE report (or an equivalently
citable, public-domain source) before being committed as final data — cited in `CREDITS.md`
alongside VSOP87/ELP2000/Yale BSC, consistent with this project's existing data-provenance
discipline (§5 of the MVP spec).
