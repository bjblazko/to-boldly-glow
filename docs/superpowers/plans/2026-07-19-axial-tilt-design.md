# Axial Tilt & Rotation-Axis Correctness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every body (Sun, planets, moons) a real rotation axis and orbital-plane orientation, replacing the current bug where everything spins around the scene's Y axis — an axis that lies *inside* each planet's own orbital plane rather than roughly perpendicular to it.

**Architecture:** A new pure module (`solarSystem/poleOrientation.ts`) converts IAU-published pole right-ascension/declination into an ecliptic-frame direction vector, and builds the minimal rotation matrix that aligns a body's local +Z axis with that direction. Every body's world matrix becomes `translate · tiltRotation · spin(around local Z) · scale` instead of today's `translate · fromYRotation · scale`. Moons get the same treatment for their *orbital plane* (composed from their parent's tilt plus the moon's own small inclination/node), replacing today's always-flat `(x, 0, z)` orbit math.

**Tech Stack:** TypeScript, gl-matrix (`mat4`, `quat`, `vec3`), Vitest, existing `@toboldlyglow/engine` VSOP87 position functions.

## Global Constraints

- No precession modeled (multi-thousand-year timescale, irrelevant given the time controller's fastest preset is 1 year/s) — pole direction is fixed at its J2000 value.
- No per-body prime-meridian alignment (which exact surface feature faces which direction is not modeled or sourced).
- The Moon is a documented special case: its orbital plane is built from ecliptic-north directly, not composed with Earth's own pole direction, because its real orbital plane precesses relative to the ecliptic (not relative to Earth's equator) — see spec `docs/superpowers/specs/2026-07-19-axial-tilt-design.md` §2.
- Ascending node is set to 0° for the 8 moons whose inclination is under half a degree (visually imperceptible either way) and to a documented illustrative value for Triton (whose real node precesses with a ~678-year period and isn't a fixed constant).
- Retrograde bodies (Venus, Uranus) **keep** a negative `siderealRotationHours` — tilt magnitude alone doesn't reliably indicate spin direction, since IAU's own published pole for Uranus derives a tilt of ~82° (under 90°) under the "invariable-plane-north" convention, even though its rotation is genuinely retrograde relative to that pole. Tilt (orientation) and rotation sign (spin direction) are independent facts here, not one deriving the other.

---

## Task 1: `poleOrientation.ts` — RA/Dec → ecliptic pole direction, and axis-alignment rotation

**Files:**
- Create: `packages/app/src/solarSystem/poleOrientation.ts`
- Test: `packages/app/test/poleOrientation.test.ts`

**Interfaces:**
- Produces: `ECLIPTIC_NORTH: readonly [number, number, number]`, `equatorialToEclipticPoleDirection(raDegrees: number, decDegrees: number): [number, number, number]`, `axisAlignmentRotation(direction: readonly [number, number, number]): mat4` — all three consumed by Task 4 (`moonOrbit.ts`) and Task 7 (`main.ts`).

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/app/test/poleOrientation.test.ts
import { describe, expect, it } from 'vitest'
import { vec3 } from 'gl-matrix'
import {
  axisAlignmentRotation,
  ECLIPTIC_NORTH,
  equatorialToEclipticPoleDirection,
} from '../src/solarSystem/poleOrientation'

const OBLIQUITY_DEGREES = 23.4392911

describe('equatorialToEclipticPoleDirection', () => {
  it("returns ecliptic-north tilted by exactly the obliquity for Earth's pole (dec=90, RA undefined/arbitrary)", () => {
    // Earth's own rotation axis IS the equatorial frame's pole by definition (RA is meaningless
    // at exactly the pole - any value works), so this is also a check that the function tolerates
    // an arbitrary RA at dec=90 without blowing up.
    const result = equatorialToEclipticPoleDirection(0, 90)
    const obliquityRadians = (OBLIQUITY_DEGREES * Math.PI) / 180
    expect(result[0]).toBeCloseTo(0, 10)
    expect(result[1]).toBeCloseTo(Math.sin(obliquityRadians), 6)
    expect(result[2]).toBeCloseTo(Math.cos(obliquityRadians), 6)
  })

  it('always returns a unit vector', () => {
    for (const [ra, dec] of [
      [286.13, 63.87],
      [92.76, -67.16],
      [257.31, -15.18],
      [40.59, 83.54],
    ]) {
      const [x, y, z] = equatorialToEclipticPoleDirection(ra, dec)
      expect(Math.hypot(x, y, z)).toBeCloseTo(1, 10)
    }
  })

  it('a pole near the equatorial south points mostly away from ecliptic-north', () => {
    const result = equatorialToEclipticPoleDirection(92.76, -67.16) // Venus
    expect(result[2]).toBeLessThan(0)
  })
})

describe('axisAlignmentRotation', () => {
  it('is the identity when the direction is already ecliptic-north', () => {
    const matrix = axisAlignmentRotation(ECLIPTIC_NORTH)
    const transformed = vec3.transformMat4(vec3.create(), [0, 0, 1], matrix)
    expect(transformed[0]).toBeCloseTo(0, 10)
    expect(transformed[1]).toBeCloseTo(0, 10)
    expect(transformed[2]).toBeCloseTo(1, 10)
  })

  it('maps local +Z onto the given direction for a variety of directions', () => {
    const directions: [number, number, number][] = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, -1],
      [0.6, 0.8, 0],
    ]
    for (const direction of directions) {
      const matrix = axisAlignmentRotation(direction)
      const transformed = vec3.transformMat4(vec3.create(), [0, 0, 1], matrix)
      expect(transformed[0]).toBeCloseTo(direction[0], 10)
      expect(transformed[1]).toBeCloseTo(direction[1], 10)
      expect(transformed[2]).toBeCloseTo(direction[2], 10)
    }
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/app && npx vitest run test/poleOrientation.test.ts`
Expected: FAIL — `Cannot find module '../src/solarSystem/poleOrientation'` (the module doesn't exist yet).

- [ ] **Step 3: Write the implementation**

```typescript
// packages/app/src/solarSystem/poleOrientation.ts
import { mat4, quat } from 'gl-matrix'

// Earth's obliquity of the ecliptic at J2000 (IAU-adopted constant). IAU pole right-
// ascension/declination values are published in the equatorial (ICRF) frame; this converts them
// into this app's ecliptic-referenced scene frame.
const OBLIQUITY_OF_ECLIPTIC_RADIANS = (23.4392911 * Math.PI) / 180

// The scene axis @toboldlyglow/engine's sphericalToX/Y/Z convention treats as "out of the orbital
// plane" (sphericalToZ = radius * sin(latitude)). This is the default, zero-tilt pole direction.
export const ECLIPTIC_NORTH: readonly [number, number, number] = [0, 0, 1]

// Converts a body's real north-pole direction from equatorial (RA/Dec, degrees, as published by
// the IAU Working Group on Cartographic Coordinates and Rotational Elements) into this app's
// ecliptic scene frame: x,y in-plane, z out-of-plane.
export function equatorialToEclipticPoleDirection(
  raDegrees: number,
  decDegrees: number,
): [number, number, number] {
  const ra = (raDegrees * Math.PI) / 180
  const dec = (decDegrees * Math.PI) / 180
  const xEquatorial = Math.cos(dec) * Math.cos(ra)
  const yEquatorial = Math.cos(dec) * Math.sin(ra)
  const zEquatorial = Math.sin(dec)
  const cosObliquity = Math.cos(OBLIQUITY_OF_ECLIPTIC_RADIANS)
  const sinObliquity = Math.sin(OBLIQUITY_OF_ECLIPTIC_RADIANS)
  // Standard equatorial-to-ecliptic rotation: about the shared x-axis (the vernal equinox
  // direction) by the negative of the obliquity.
  return [
    xEquatorial,
    yEquatorial * cosObliquity + zEquatorial * sinObliquity,
    -yEquatorial * sinObliquity + zEquatorial * cosObliquity,
  ]
}

// The minimal rotation matrix mapping the local +Z axis onto `direction` (assumed a unit vector).
// Used to tilt a body (or an orbital plane) that's defined "flat" - aligned with local Z - into
// its real 3D orientation in one step.
export function axisAlignmentRotation(direction: readonly [number, number, number]): mat4 {
  const rotation = quat.rotationTo(quat.create(), [0, 0, 1], direction)
  return mat4.fromQuat(mat4.create(), rotation)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd packages/app && npx vitest run test/poleOrientation.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Typecheck and lint**

Run: `cd packages/app && npx tsc --noEmit`
Run: `npx eslint packages/app/src/solarSystem/poleOrientation.ts packages/app/test/poleOrientation.test.ts` (from repo root)
Expected: no output (clean)

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/solarSystem/poleOrientation.ts packages/app/test/poleOrientation.test.ts
git commit -m "Add pole-direction conversion and axis-alignment rotation for real axial tilt"
```

---

## Task 2: `bodies.ts` — add real pole RA/Dec

**Files:**
- Modify: `packages/app/src/solarSystem/bodies.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `BodyDefinition.poleRightAscensionDegrees: number`, `BodyDefinition.poleDeclinationDegrees: number` — consumed by Task 4 (`moonOrbit.ts`), Task 6 (integration tests), and Task 7 (`main.ts`).

- [ ] **Step 1: Update the `BodyDefinition` interface**

In `packages/app/src/solarSystem/bodies.ts`, update the `siderealRotationHours` doc comment's stale axis reference (it keeps its existing signed meaning - this is NOT changing to always-positive, per the corrected design) and add two new fields (inside the `BodyDefinition` interface, immediately after the `siderealRotationHours` field, which currently ends at line 43):

```typescript
  /**
   * Axial rotation period, hours. Source: NASA Planetary Fact Sheet. Negative means retrograde
   * (spins opposite its orbital direction — Venus and, due to its extreme axial tilt, Uranus).
   * Drives the body's own spin around its local Z axis (see poleOrientation.ts - tilt happens on
   * top of this spin, not instead of it); unrelated to siderealPeriodDays (orbital motion) above.
   * This sign is independent of poleRightAscensionDegrees/poleDeclinationDegrees below - tilt
   * magnitude does NOT reliably indicate spin direction (IAU's own published pole for Uranus
   * derives a tilt under 90° despite Uranus's rotation being genuinely retrograde relative to it -
   * see the design spec §3), so this field keeps carrying that fact explicitly.
   */
  siderealRotationHours: number
  /**
   * North pole right ascension and declination, degrees, J2000 equatorial (ICRF) frame, as
   * published by the IAU Working Group on Cartographic Coordinates and Rotational Elements
   * (WGCCRE). Converted to an ecliptic-frame direction vector by
   * poleOrientation.ts's equatorialToEclipticPoleDirection, then used to tilt the body's spin
   * axis (and, for Saturn, its ring) into its real 3D orientation.
   */
  poleRightAscensionDegrees: number
  poleDeclinationDegrees: number
```

- [ ] **Step 2: Update each body's data with real pole values and positive rotation periods**

Change `SUN` (currently lines 48-58):

```typescript
export const SUN: BodyDefinition = {
  id: 'sun',
  name: 'Sun',
  color: [1.0, 0.9, 0.6],
  radiusKm: 696_000,
  explorerVisualRadius: 3,
  siderealPeriodDays: null,
  position: null,
  textureUrl: '/textures/sun.jpg',
  siderealRotationHours: 609.12,
  poleRightAscensionDegrees: 286.13,
  poleDeclinationDegrees: 63.87,
}
```

In the `PLANETS` array, add `poleRightAscensionDegrees`/`poleDeclinationDegrees` to each entry (immediately after each planet's `siderealRotationHours` line), and change Venus's and Uranus's `siderealRotationHours` to positive:

```typescript
  {
    id: 'mercury',
    // ...unchanged fields...
    siderealRotationHours: 1407.6,
    poleRightAscensionDegrees: 281.01,
    poleDeclinationDegrees: 61.41,
  },
  {
    id: 'venus',
    // ...unchanged fields...
    siderealRotationHours: -5832.5, // unchanged - retrograde sign stays independent of tilt (see field doc)
    poleRightAscensionDegrees: 92.76,
    poleDeclinationDegrees: -67.16,
  },
  {
    id: 'earth',
    // ...unchanged fields...
    siderealRotationHours: 23.9345,
    // RA is meaningless at exactly the pole (Earth's own rotation axis IS the equatorial frame's
    // pole by definition), so any value works here - 0 is used arbitrarily.
    poleRightAscensionDegrees: 0,
    poleDeclinationDegrees: 90,
  },
  {
    id: 'mars',
    // ...unchanged fields...
    siderealRotationHours: 24.6229,
    poleRightAscensionDegrees: 317.68,
    poleDeclinationDegrees: 52.89,
  },
  {
    id: 'jupiter',
    // ...unchanged fields...
    siderealRotationHours: 9.925,
    poleRightAscensionDegrees: 268.06,
    poleDeclinationDegrees: 64.50,
  },
  {
    id: 'saturn',
    // ...unchanged fields...
    siderealRotationHours: 10.656,
    poleRightAscensionDegrees: 40.59,
    poleDeclinationDegrees: 83.54,
  },
  {
    id: 'uranus',
    // ...unchanged fields...
    siderealRotationHours: -17.24, // unchanged - retrograde sign stays independent of tilt (see field doc)
    poleRightAscensionDegrees: 257.31,
    poleDeclinationDegrees: -15.18,
  },
  {
    id: 'neptune',
    // ...unchanged fields...
    siderealRotationHours: 16.11,
    poleRightAscensionDegrees: 299.33,
    poleDeclinationDegrees: 42.95,
  },
```

- [ ] **Step 3: Run the existing body-registry tests to confirm nothing broke**

Run: `cd packages/app && npx vitest run test/bodies.test.ts`
Expected: PASS (5 tests) — this file doesn't assert on rotation-hour sign or pole fields, so it should be unaffected; this step is a regression check.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/solarSystem/bodies.ts
git commit -m "Add real IAU pole RA/Dec to bodies.ts"
```

(Full-workspace typecheck is deferred to later tasks, since `main.ts` won't reference the new fields until Task 7 — a standalone `tsc --noEmit` here would fail on unrelated not-yet-updated call sites.)

---

## Task 3: `moons.ts` — add real orbital-plane elements

**Files:**
- Modify: `packages/app/src/solarSystem/moons.ts`

**Interfaces:**
- Produces: `MoonDefinition.orbitInclinationToParentEquatorDegrees: number`, `MoonDefinition.orbitAscendingNodeDegrees: number` — consumed by Task 4 (`moonOrbit.ts`), Task 5 (`entities.ts`), Task 6 (integration tests), and Task 7 (`main.ts`).

- [ ] **Step 1: Update the `MoonDefinition` interface**

In `packages/app/src/solarSystem/moons.ts`, add two fields after `siderealOrbitPeriodDays` (which currently ends its doc comment/field at line 23):

```typescript
  /**
   * Real orbital inclination, degrees, relative to the parent's equatorial plane (the Laplace
   * plane, for the regular moons) - EXCEPT for the Moon, whose real orbital plane precesses
   * relative to the ECLIPTIC rather than Earth's equator (see
   * moonOrbit.ts's moonOrbitReferencePoleDirection), so this field holds its ecliptic-relative
   * inclination instead. Source: Wikipedia orbital-elements infoboxes (themselves derived from
   * JPL/IAU data); Triton's value is a representative snapshot since its node precesses with a
   * ~678-year period that isn't modeled.
   */
  orbitInclinationToParentEquatorDegrees: number
  /**
   * Longitude of the ascending node, degrees, defining which direction (within the reference
   * plane) the inclination above tilts toward. Set to 0 for every moon except Triton as a
   * documented simplification: at under half a degree of inclination, the node has no visually
   * perceptible effect for the other 8 moons. Triton's value is illustrative (see the field above).
   */
  orbitAscendingNodeDegrees: number
```

- [ ] **Step 2: Add the real values to each moon in `MOONS`**

Add both new fields to each of the 9 entries (immediately after each moon's `siderealOrbitPeriodDays` line):

```typescript
  {
    id: 'moon',
    // ...unchanged fields...
    siderealOrbitPeriodDays: 27.321661,
    orbitInclinationToParentEquatorDegrees: 5.145, // to the ecliptic, not Earth's equator - see field doc
    orbitAscendingNodeDegrees: 0,
    textureUrl: '/textures/moon.jpg',
  },
  {
    id: 'io',
    // ...unchanged fields...
    siderealOrbitPeriodDays: 1.769138,
    orbitInclinationToParentEquatorDegrees: 0.050,
    orbitAscendingNodeDegrees: 0,
    textureUrl: '/textures/io.jpg',
  },
  {
    id: 'europa',
    // ...unchanged fields...
    siderealOrbitPeriodDays: 3.551181,
    orbitInclinationToParentEquatorDegrees: 0.471,
    orbitAscendingNodeDegrees: 0,
    textureUrl: '/textures/europa.jpg',
  },
  {
    id: 'ganymede',
    // ...unchanged fields...
    siderealOrbitPeriodDays: 7.154553,
    orbitInclinationToParentEquatorDegrees: 0.204,
    orbitAscendingNodeDegrees: 0,
    textureUrl: '/textures/ganymede.jpg',
  },
  {
    id: 'callisto',
    // ...unchanged fields...
    siderealOrbitPeriodDays: 16.68902,
    orbitInclinationToParentEquatorDegrees: 0.205,
    orbitAscendingNodeDegrees: 0,
    textureUrl: '/textures/callisto.jpg',
  },
  {
    id: 'titan',
    // ...unchanged fields...
    siderealOrbitPeriodDays: 15.945,
    orbitInclinationToParentEquatorDegrees: 0.34854,
    orbitAscendingNodeDegrees: 0,
    textureUrl: '/textures/titan.jpg',
  },
  {
    id: 'titania',
    // ...unchanged fields...
    siderealOrbitPeriodDays: 8.706234,
    orbitInclinationToParentEquatorDegrees: 0.114,
    orbitAscendingNodeDegrees: 0,
  },
  {
    id: 'oberon',
    // ...unchanged fields...
    siderealOrbitPeriodDays: 13.463234,
    orbitInclinationToParentEquatorDegrees: 0.125,
    orbitAscendingNodeDegrees: 0,
  },
  {
    id: 'triton',
    // ...unchanged fields...
    siderealOrbitPeriodDays: -5.876854,
    orbitInclinationToParentEquatorDegrees: 157.3, // illustrative snapshot - real value precesses, see field doc
    orbitAscendingNodeDegrees: 0, // illustrative, see field doc
  },
```

- [ ] **Step 3: Commit**

```bash
git add packages/app/src/solarSystem/moons.ts
git commit -m "Add real orbital-plane inclination/ascending-node data to moons.ts"
```

(No test file exists for `moons.ts` in isolation today, and this is data-only — Task 6's integration tests exercise these values against real geometry.)

---

## Task 4: `moonOrbit.ts` — flat-orbit convention, orbital-plane tilt, corrected tidal-lock sign

**Files:**
- Modify: `packages/app/src/solarSystem/moonOrbit.ts`
- Modify: `packages/app/test/moonOrbit.test.ts`

**Interfaces:**
- Consumes: `axisAlignmentRotation`, `ECLIPTIC_NORTH`, `equatorialToEclipticPoleDirection` from `./poleOrientation` (Task 1); `BodyDefinition` from `./bodies` (Task 2); `MoonDefinition` from `./moons` (Task 3).
- Produces: `moonFlatOrbitPosition(orbitRadius, angleRadians): [number, number, number]`, `moonOrbitPlaneTiltMatrix(inclinationDegrees, ascendingNodeDegrees, referencePoleDirection): mat4`, `moonOrbitReferencePoleDirection(moon: MoonDefinition, parent: BodyDefinition): [number, number, number]`, `moonRelativePosition(orbitRadius, angleRadians, inclinationDegrees, ascendingNodeDegrees, referencePoleDirection): [number, number, number]` (signature change - 3 new required parameters), `moonRotationAngleRadians(orbitAngleRadians): number` (unchanged signature, **sign flips back to positive** - see Step 3 below). `moonOrbitAngleRadians` and `scaledMoonOrbitRadiusUnits` are unchanged. Consumed by Task 5 (`entities.ts`), Task 6 (integration tests), and Task 7 (`main.ts`).

**Important:** this task *re-derives* the tidal-lock sign fixed in a previous session. That fix (`return -orbitAngleRadians`) was correct only for the old convention (spin around local Y, orbit flat in the XZ-plane). This task switches moon spin to local Z (matching planets, per Task 7) and the flat orbit to the XY-plane (matching `@toboldlyglow/engine`'s convention) - under that convention, the correct sign is positive again. Step 1's test is written to fail if this regresses back to the old (now wrong) sign.

- [ ] **Step 1: Write the failing tests (full replacement of `moonOrbit.test.ts`)**

```typescript
// packages/app/test/moonOrbit.test.ts
import { mat4, vec3 } from 'gl-matrix'
import { describe, expect, it } from 'vitest'
import {
  moonFlatOrbitPosition,
  moonOrbitAngleRadians,
  moonOrbitPlaneTiltMatrix,
  moonOrbitReferencePoleDirection,
  moonRelativePosition,
  moonRotationAngleRadians,
  scaledMoonOrbitRadiusUnits,
} from '../src/solarSystem/moonOrbit'
import { ECLIPTIC_NORTH, equatorialToEclipticPoleDirection } from '../src/solarSystem/poleOrientation'
import { AU_TO_SCENE_UNITS } from '../src/solarSystem/sceneScale'
import type { BodyDefinition } from '../src/solarSystem/bodies'
import type { MoonDefinition } from '../src/solarSystem/moons'

const AU_KM = 149_597_870.7

describe('scaledMoonOrbitRadiusUnits', () => {
  it('matches the true AU-consistent scale at blend=0', () => {
    const orbitDistanceKm = 384_400 // the Moon
    const result = scaledMoonOrbitRadiusUnits(orbitDistanceKm, 1.7, 0, AU_KM)
    expect(result).toBeCloseTo((orbitDistanceKm / AU_KM) * AU_TO_SCENE_UNITS, 10)
  })

  it('matches the hand-picked explorer radius at blend=1', () => {
    const result = scaledMoonOrbitRadiusUnits(384_400, 1.7, 1, AU_KM)
    expect(result).toBeCloseTo(1.7, 10)
  })

  it('interpolates linearly (no log compression) between the two endpoints', () => {
    const orbitDistanceKm = 384_400
    const explorerRadius = 1.7
    const realistic = (orbitDistanceKm / AU_KM) * AU_TO_SCENE_UNITS
    const atHalf = scaledMoonOrbitRadiusUnits(orbitDistanceKm, explorerRadius, 0.5, AU_KM)
    expect(atHalf).toBeCloseTo((realistic + explorerRadius) / 2, 10)
  })
})

describe('moonOrbitAngleRadians', () => {
  it('is zero at the epoch', () => {
    expect(moonOrbitAngleRadians(0, 27.321661)).toBe(0)
  })

  it('completes one full turn after one orbital period', () => {
    const period = 27.321661
    expect(moonOrbitAngleRadians(period, period)).toBeCloseTo(2 * Math.PI, 10)
  })

  it('moves in the opposite direction for a negative (retrograde) period', () => {
    expect(moonOrbitAngleRadians(1, 5.876854)).toBeGreaterThan(0)
    expect(moonOrbitAngleRadians(1, -5.876854)).toBeLessThan(0)
  })
})

describe('moonFlatOrbitPosition', () => {
  it('stays at a constant distance from the parent for any angle', () => {
    const orbitRadius = 1.7
    for (const angle of [0, Math.PI / 4, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
      const [x, y, z] = moonFlatOrbitPosition(orbitRadius, angle)
      expect(Math.hypot(x, y, z)).toBeCloseTo(orbitRadius, 10)
    }
  })

  it('stays in the ecliptic-aligned XY-plane (z=0), before any tilt is applied', () => {
    const [, , z] = moonFlatOrbitPosition(1.7, 1.234)
    expect(z).toBe(0)
  })
})

describe('moonOrbitPlaneTiltMatrix', () => {
  it('is the identity when inclination and node are both zero and the reference is ecliptic-north', () => {
    const matrix = moonOrbitPlaneTiltMatrix(0, 0, ECLIPTIC_NORTH)
    const transformed = vec3.transformMat4(vec3.create(), [1, 0, 0], matrix)
    expect(transformed[0]).toBeCloseTo(1, 10)
    expect(transformed[1]).toBeCloseTo(0, 10)
    expect(transformed[2]).toBeCloseTo(0, 10)
  })

  it('tilts the flat plane to match the reference pole direction when inclination is zero', () => {
    const reference: [number, number, number] = [1, 0, 0]
    const matrix = moonOrbitPlaneTiltMatrix(0, 0, reference)
    // The local Z axis (the flat plane's normal) should now point along `reference`.
    const normal = vec3.transformMat4(vec3.create(), [0, 0, 1], matrix)
    expect(normal[0]).toBeCloseTo(reference[0], 10)
    expect(normal[1]).toBeCloseTo(reference[1], 10)
    expect(normal[2]).toBeCloseTo(reference[2], 10)
  })

  it('a 90-degree inclination produces an orbit-plane normal perpendicular to ecliptic-north', () => {
    const matrix = moonOrbitPlaneTiltMatrix(90, 0, ECLIPTIC_NORTH)
    const normal = vec3.transformMat4(vec3.create(), [0, 0, 1], matrix)
    expect(vec3.dot(normal, ECLIPTIC_NORTH)).toBeCloseTo(0, 6)
  })
})

describe('moonOrbitReferencePoleDirection', () => {
  const fakeParent: BodyDefinition = {
    id: 'fakeplanet',
    name: 'Fake Planet',
    color: [1, 1, 1],
    radiusKm: 1000,
    explorerVisualRadius: 1,
    siderealPeriodDays: 100,
    position: null,
    textureUrl: '',
    siderealRotationHours: 10,
    poleRightAscensionDegrees: 40.59,
    poleDeclinationDegrees: 83.54,
  }

  it("returns ECLIPTIC_NORTH for the Moon, regardless of Earth's own pole direction", () => {
    const moon: MoonDefinition = {
      id: 'moon',
      name: 'Moon',
      parentId: 'earth',
      color: [1, 1, 1],
      radiusKm: 1737.4,
      explorerVisualRadius: 0.27,
      orbitDistanceKm: 384_400,
      explorerOrbitVisualRadius: 1.7,
      siderealOrbitPeriodDays: 27.321661,
      orbitInclinationToParentEquatorDegrees: 5.145,
      orbitAscendingNodeDegrees: 0,
    }
    expect(moonOrbitReferencePoleDirection(moon, fakeParent)).toEqual(ECLIPTIC_NORTH)
  })

  it("returns the parent's pole direction for any other moon", () => {
    const moon: MoonDefinition = {
      id: 'titan',
      name: 'Titan',
      parentId: 'saturn',
      color: [1, 1, 1],
      radiusKm: 2574.7,
      explorerVisualRadius: 0.2,
      orbitDistanceKm: 1_221_870,
      explorerOrbitVisualRadius: 5.5,
      siderealOrbitPeriodDays: 15.945,
      orbitInclinationToParentEquatorDegrees: 0.34854,
      orbitAscendingNodeDegrees: 0,
    }
    const expected = equatorialToEclipticPoleDirection(fakeParent.poleRightAscensionDegrees, fakeParent.poleDeclinationDegrees)
    const actual = moonOrbitReferencePoleDirection(moon, fakeParent)
    expect(actual[0]).toBeCloseTo(expected[0], 10)
    expect(actual[1]).toBeCloseTo(expected[1], 10)
    expect(actual[2]).toBeCloseTo(expected[2], 10)
  })
})

describe('moonRelativePosition', () => {
  it('stays at a constant distance from the parent for any angle, tilt included', () => {
    const orbitRadius = 1.7
    for (const angle of [0, Math.PI / 4, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
      const [x, y, z] = moonRelativePosition(orbitRadius, angle, 5, 10, ECLIPTIC_NORTH)
      expect(Math.hypot(x, y, z)).toBeCloseTo(orbitRadius, 10)
    }
  })

  it('matches moonFlatOrbitPosition composed with moonOrbitPlaneTiltMatrix', () => {
    const orbitRadius = 1.7
    const angle = 1.1
    const inclination = 12
    const node = 34
    const reference: [number, number, number] = [0.3, 0.4, Math.sqrt(1 - 0.09 - 0.16)]
    const flat = moonFlatOrbitPosition(orbitRadius, angle)
    const tilt = moonOrbitPlaneTiltMatrix(inclination, node, reference)
    const expected = vec3.transformMat4(vec3.create(), flat, tilt)
    const actual = moonRelativePosition(orbitRadius, angle, inclination, node, reference)
    expect(actual[0]).toBeCloseTo(expected[0], 10)
    expect(actual[1]).toBeCloseTo(expected[1], 10)
    expect(actual[2]).toBeCloseTo(expected[2], 10)
  })
})

describe('tidal lock: moonRotationAngleRadians combined with moonFlatOrbitPosition', () => {
  // Reproduces how main.ts builds a moon's world matrix under the local-Z-spin/XY-plane
  // convention (see Task 7): flat position via moonFlatOrbitPosition, spin via
  // mat4.fromZRotation. Checks that a fixed local reference point maintains a CONSTANT angular
  // offset from the true parent direction across a full orbit - the definition of tidal lock.
  // This test is written to FAIL if moonRotationAngleRadians still negates the angle (the sign
  // that was correct under the old Y-axis-spin/XZ-plane convention, but is wrong under this one).
  function planarAngle(v: vec3): number {
    return Math.atan2(v[1], v[0])
  }

  function nearSideOffsetFromParent(angle: number, orbitRadius: number): number {
    const relativePosition = moonFlatOrbitPosition(orbitRadius, angle)
    const directionToParent = vec3.normalize(vec3.create(), vec3.negate(vec3.create(), relativePosition))
    const rotation = moonRotationAngleRadians(angle)
    const rotationMatrix = mat4.fromZRotation(mat4.create(), rotation)
    const nearSideDirection = vec3.transformMat4(vec3.create(), [1, 0, 0], rotationMatrix)
    return planarAngle(nearSideDirection) - planarAngle(directionToParent)
  }

  it('holds a constant angular offset from the parent-facing direction across a full orbit', () => {
    const orbitRadius = 1.7
    const angles = [0, Math.PI / 6, Math.PI / 2, Math.PI, (4 * Math.PI) / 3, 1.9 * Math.PI]
    const offsets = angles.map((angle) => nearSideOffsetFromParent(angle, orbitRadius))
    const [first, ...rest] = offsets
    for (const offset of rest) {
      expect(Math.sin(offset)).toBeCloseTo(Math.sin(first), 6)
      expect(Math.cos(offset)).toBeCloseTo(Math.cos(first), 6)
    }
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/app && npx vitest run test/moonOrbit.test.ts`
Expected: FAIL — `moonFlatOrbitPosition`, `moonOrbitPlaneTiltMatrix`, `moonOrbitReferencePoleDirection` don't exist yet, and `moonRelativePosition` still has the old 2-argument signature.

- [ ] **Step 3: Write the implementation (full replacement of `moonOrbit.ts`)**

```typescript
// packages/app/src/solarSystem/moonOrbit.ts
import { mat4, vec3 } from 'gl-matrix'
import type { BodyDefinition } from './bodies'
import type { MoonDefinition } from './moons'
import { AU_TO_SCENE_UNITS } from './sceneScale'
import { axisAlignmentRotation, ECLIPTIC_NORTH, equatorialToEclipticPoleDirection } from './poleOrientation'

// blend: 0 = fully realistic (the same true-AU-consistent scale used everywhere else), 1 = fully
// explorer (a hand-picked explorerOrbitVisualRadius, in the same spirit as each body's own
// explorerVisualRadius). Unlike scaledDistanceUnits, this has no log1p compression — moon-to-parent
// distance ratios are far more uniform across this body set than the 0.39-30 AU spread between
// planets, so a simple linear blend already looks reasonable without needing to compress outliers.
export function scaledMoonOrbitRadiusUnits(
  orbitDistanceKm: number,
  explorerOrbitVisualRadius: number,
  blend: number,
  auKm: number,
): number {
  const realistic = (orbitDistanceKm / auKm) * AU_TO_SCENE_UNITS
  return realistic + (explorerOrbitVisualRadius - realistic) * blend
}

// Progress angle around the orbit, measured from an arbitrary epoch reference (this app doesn't
// model real orbital phase at J2000 for moons any more precisely than this). Driven by real
// elapsed time, so a negative period (Triton, uniquely among large moons, orbits retrograde)
// naturally produces motion in the opposite direction. The orbital PLANE's orientation is handled
// separately by moonOrbitPlaneTiltMatrix, not here.
export function moonOrbitAngleRadians(daysSinceEpoch: number, siderealOrbitPeriodDays: number): number {
  return (daysSinceEpoch / siderealOrbitPeriodDays) * 2 * Math.PI
}

// Tidally locked moons keep one face toward their parent as they orbit. With spin applied around
// local Z (matching how planets spin - see poleOrientation.ts/main.ts) and the flat orbital
// position built in the XY-plane (see moonFlatOrbitPosition), the correct sign is the SAME as the
// orbital angle. This is the opposite of the sign needed under this app's previous Y-axis-spin/
// XZ-plane convention: mat4.fromYRotation maps local +Z to (sin, 0, cos), a coordinate order that
// required negating the angle to stay locked, whereas mat4.fromZRotation maps local +X to
// (cos, sin, 0) directly, needing no negation. Verified in moonOrbit.test.ts.
export function moonRotationAngleRadians(orbitAngleRadians: number): number {
  return orbitAngleRadians
}

// Position on a flat circular orbit lying in the ecliptic-aligned XY-plane (matching
// @toboldlyglow/engine's convention, where z is the out-of-plane axis) - i.e. the moon's position
// before any tilt (from its parent's real axial tilt, or the moon's own small inclination to its
// parent's equator) is applied. See moonOrbitPlaneTiltMatrix for the tilt step.
export function moonFlatOrbitPosition(orbitRadius: number, angleRadians: number): [number, number, number] {
  return [orbitRadius * Math.cos(angleRadians), orbitRadius * Math.sin(angleRadians), 0]
}

// The rotation that tilts a moon's flat (untitled) orbital plane into its real 3D orientation:
// first inclines it by the moon's own small inclination-to-parent-equator (rotation about the
// local X axis), then rotates that tilt to face the given ascending node direction (rotation
// about local Z), then aligns the whole thing so its normal points along the reference pole
// direction (see axisAlignmentRotation) - the classical inclination/node composition used for
// orbital elements, applied as a single matrix reused for both a moon's position (see
// moonRelativePosition) and its own spin (tidal lock is preserved under any single rigid
// transform applied uniformly to both - see moonRotationAngleRadians).
export function moonOrbitPlaneTiltMatrix(
  inclinationToParentEquatorDegrees: number,
  ascendingNodeDegrees: number,
  referencePoleDirection: readonly [number, number, number],
): mat4 {
  const inclinationRadians = (inclinationToParentEquatorDegrees * Math.PI) / 180
  const nodeRadians = (ascendingNodeDegrees * Math.PI) / 180
  const inclination = mat4.fromXRotation(mat4.create(), inclinationRadians)
  const node = mat4.fromZRotation(mat4.create(), nodeRadians)
  const nodeThenInclination = mat4.multiply(mat4.create(), node, inclination)
  return mat4.multiply(mat4.create(), axisAlignmentRotation(referencePoleDirection), nodeThenInclination)
}

// The Moon's real orbital plane precesses relative to the ECLIPTIC (not relative to Earth's
// equator) with an ~18.6-year period, driven by solar perturbation - unlike the other 8 moons in
// this set, whose orbital planes genuinely track their parent's equatorial bulge. Since
// precession isn't modeled, the Moon is built directly from ecliptic-north rather than composed
// with Earth's pole direction; every other moon composes with its real parent.
export function moonOrbitReferencePoleDirection(
  moon: MoonDefinition,
  parent: BodyDefinition,
): [number, number, number] {
  if (moon.id === 'moon') return [...ECLIPTIC_NORTH]
  return equatorialToEclipticPoleDirection(parent.poleRightAscensionDegrees, parent.poleDeclinationDegrees)
}

// A moon's position relative to its parent's center, combining its flat orbital motion with the
// real 3D tilt of its orbital plane.
export function moonRelativePosition(
  orbitRadius: number,
  angleRadians: number,
  inclinationToParentEquatorDegrees: number,
  ascendingNodeDegrees: number,
  referencePoleDirection: readonly [number, number, number],
): [number, number, number] {
  const flat = moonFlatOrbitPosition(orbitRadius, angleRadians)
  const tilt = moonOrbitPlaneTiltMatrix(inclinationToParentEquatorDegrees, ascendingNodeDegrees, referencePoleDirection)
  const tilted = vec3.transformMat4(vec3.create(), flat, tilt)
  return [tilted[0], tilted[1], tilted[2]]
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd packages/app && npx vitest run test/moonOrbit.test.ts`
Expected: PASS (all tests in the file)

- [ ] **Step 5: Typecheck and lint**

Run: `cd packages/app && npx tsc --noEmit`
Run: `npx eslint packages/app/src/solarSystem/moonOrbit.ts packages/app/test/moonOrbit.test.ts` (from repo root)
Expected: no output (clean) — full-workspace typecheck will still fail until Task 7 (`main.ts`'s call sites); that's expected mid-plan.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/solarSystem/moonOrbit.ts packages/app/test/moonOrbit.test.ts
git commit -m "Rebuild moon orbital-plane math on real tilt composition; re-derive tidal-lock sign for the new local-Z-spin convention"
```

---

## Task 5: `entities.ts` — thread orbital-plane data through `entityWorldPosition`

**Files:**
- Modify: `packages/app/src/solarSystem/entities.ts`
- Modify: `packages/app/test/entities.test.ts`

**Interfaces:**
- Consumes: `moonOrbitReferencePoleDirection`, `moonRelativePosition` (new signature) from `./moonOrbit` (Task 4).
- Produces: `entityWorldPosition` keeps its existing signature/return type — no change for `cameraFollow.ts`/`cameraFollow.test.ts`, which only depend on that black-box behavior.

- [ ] **Step 1: Update the failing test (the moon case in `entityWorldPosition`)**

In `packages/app/test/entities.test.ts`, update the import and the moon test:

```typescript
import { moonOrbitAngleRadians, moonOrbitReferencePoleDirection, moonRelativePosition, scaledMoonOrbitRadiusUnits } from '../src/solarSystem/moonOrbit'
```

```typescript
  it("matches parent position plus orbital offset for a moon", () => {
    const titan = findEntity('titan')
    const saturn = findEntity('saturn')
    const [px, py, pz] = entityWorldPosition(saturn, T, daysSinceEpoch, scaleBlend)
    const moon = titan.definition as (typeof MOONS)[number]
    const angle = moonOrbitAngleRadians(daysSinceEpoch, moon.siderealOrbitPeriodDays)
    const orbitRadius = scaledMoonOrbitRadiusUnits(moon.orbitDistanceKm, moon.explorerOrbitVisualRadius, scaleBlend, AU_KM)
    const referencePoleDirection = moonOrbitReferencePoleDirection(moon, saturn.definition as (typeof PLANETS)[number])
    const [rx, ry, rz] = moonRelativePosition(
      orbitRadius,
      angle,
      moon.orbitInclinationToParentEquatorDegrees,
      moon.orbitAscendingNodeDegrees,
      referencePoleDirection,
    )
    const actual = entityWorldPosition(titan, T, daysSinceEpoch, scaleBlend)
    expect(actual[0]).toBeCloseTo(px + rx, 10)
    expect(actual[1]).toBeCloseTo(py + ry, 10)
    expect(actual[2]).toBeCloseTo(pz + rz, 10)
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/app && npx vitest run test/entities.test.ts`
Expected: FAIL — `entityWorldPosition`'s internal moon branch still calls the old 2-argument `moonRelativePosition`, so this file won't typecheck/run against the new `moonOrbit.ts` signature yet.

- [ ] **Step 3: Update `entityWorldPosition`'s moon branch**

In `packages/app/src/solarSystem/entities.ts`, update the import and the moon branch:

```typescript
import { moonOrbitAngleRadians, moonOrbitReferencePoleDirection, moonRelativePosition, scaledMoonOrbitRadiusUnits } from './moonOrbit'
```

```typescript
  const moon = entity.definition as MoonDefinition
  const parent = ALL_ENTITIES.find((e) => e.id === moon.parentId)
  if (!parent) throw new Error(`${moon.id} has no known parent ${moon.parentId}.`)
  const [px, py, pz] = entityWorldPosition(parent, T, daysSinceEpoch, scaleBlend)
  const angle = moonOrbitAngleRadians(daysSinceEpoch, moon.siderealOrbitPeriodDays)
  const orbitRadius = scaledMoonOrbitRadiusUnits(moon.orbitDistanceKm, moon.explorerOrbitVisualRadius, scaleBlend, AU_KM)
  const referencePoleDirection = moonOrbitReferencePoleDirection(moon, parent.definition as BodyDefinition)
  const [rx, ry, rz] = moonRelativePosition(
    orbitRadius,
    angle,
    moon.orbitInclinationToParentEquatorDegrees,
    moon.orbitAscendingNodeDegrees,
    referencePoleDirection,
  )
  return [px + rx, py + ry, pz + rz]
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd packages/app && npx vitest run test/entities.test.ts`
Expected: PASS (all tests)

- [ ] **Step 5: Run the full unit test suite to check `cameraFollow.test.ts` is unaffected**

Run: `cd packages/app && npx vitest run`
Expected: PASS across all files — `cameraFollow.test.ts` only calls `entityWorldPosition` as a black box, so it should be unaffected by this internal change.

- [ ] **Step 6: Typecheck and lint**

Run: `cd packages/app && npx tsc --noEmit`
Run: `npx eslint packages/app/src/solarSystem/entities.ts packages/app/test/entities.test.ts` (from repo root)
Expected: no output (clean) — full-workspace typecheck will still fail until Task 7 (`main.ts`); that's expected mid-plan.

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/solarSystem/entities.ts packages/app/test/entities.test.ts
git commit -m "Thread real orbital-plane tilt through entityWorldPosition's moon lookup"
```

---

## Task 6: Integration tests — real data produces the expected tilt geometry

**Files:**
- Create: `packages/app/test/axialTiltIntegration.test.ts`

**Interfaces:**
- Consumes: `PLANETS` from `./bodies` (Task 2), `MOONS` from `./moons` (Task 3), `ECLIPTIC_NORTH`/`equatorialToEclipticPoleDirection` from `./poleOrientation` (Task 1), `moonOrbitPlaneTiltMatrix`/`moonOrbitReferencePoleDirection` from `./moonOrbit` (Task 4).

This task adds no production code — it's a verification suite proving the real sourced data, run through the already-implemented pure functions, produces the geometry the design spec calls for (§6): Uranus rolled onto its side, Titania/Oberon near-polar around Uranus, Triton retrograde-inclined around Neptune. Since there's no new implementation to drive red-then-green, this task just writes the tests and confirms they pass against the already-complete Tasks 1-5.

- [ ] **Step 1: Write the tests**

```typescript
// packages/app/test/axialTiltIntegration.test.ts
import { vec3 } from 'gl-matrix'
import { describe, expect, it } from 'vitest'
import { PLANETS } from '../src/solarSystem/bodies'
import { MOONS } from '../src/solarSystem/moons'
import { ECLIPTIC_NORTH, equatorialToEclipticPoleDirection } from '../src/solarSystem/poleOrientation'
import { moonOrbitPlaneTiltMatrix, moonOrbitReferencePoleDirection } from '../src/solarSystem/moonOrbit'

function findPlanet(id: string) {
  const planet = PLANETS.find((p) => p.id === id)
  if (!planet) throw new Error(`no planet ${id}`)
  return planet
}

function findMoon(id: string) {
  const moon = MOONS.find((m) => m.id === id)
  if (!moon) throw new Error(`no moon ${id}`)
  return moon
}

function tiltDegreesFromEclipticNorth(direction: readonly [number, number, number]): number {
  return (Math.acos(vec3.dot(direction, ECLIPTIC_NORTH)) * 180) / Math.PI
}

describe('real pole data produces the expected axial tilts', () => {
  it("Uranus's real pole direction lies close to its own orbital plane (~90 degrees from ecliptic-north) - it effectively rolls onto its side", () => {
    const uranus = findPlanet('uranus')
    const pole = equatorialToEclipticPoleDirection(uranus.poleRightAscensionDegrees, uranus.poleDeclinationDegrees)
    const tilt = tiltDegreesFromEclipticNorth(pole)
    // IAU's officially-published pole (the "invariable-plane-north" convention) derives ~82°; the
    // commonly-cited ~97.8° describes the SAME physical axis under the other valid convention
    // (right-hand-rule prograde - a supplementary angle, not a different fact). This assertion is
    // convention-agnostic: either way, the axis lies close to the orbital plane, not close to
    // upright - which is the actual "rolls onto its side" phenomenon, independent of which pole a
    // given source calls "north."
    expect(Math.abs(tilt - 90)).toBeLessThan(15)
  })

  it("Venus's real pole direction is tilted close to 180 degrees (near-upside-down)", () => {
    const venus = findPlanet('venus')
    const pole = equatorialToEclipticPoleDirection(venus.poleRightAscensionDegrees, venus.poleDeclinationDegrees)
    expect(tiltDegreesFromEclipticNorth(pole)).toBeGreaterThan(150)
  })

  it("Earth's real pole direction is tilted by roughly its known 23.4-degree obliquity", () => {
    const earth = findPlanet('earth')
    const pole = equatorialToEclipticPoleDirection(earth.poleRightAscensionDegrees, earth.poleDeclinationDegrees)
    expect(tiltDegreesFromEclipticNorth(pole)).toBeCloseTo(23.4393, 1)
  })
})

describe("moons' real orbital-plane data produces the expected geometry", () => {
  it("Titania's and Oberon's orbital planes end up near-polar relative to the ecliptic (tracking Uranus's own extreme tilt)", () => {
    const uranus = findPlanet('uranus')
    for (const moonId of ['titania', 'oberon']) {
      const moon = findMoon(moonId)
      const referencePoleDirection = moonOrbitReferencePoleDirection(moon, uranus)
      const tiltMatrix = moonOrbitPlaneTiltMatrix(
        moon.orbitInclinationToParentEquatorDegrees,
        moon.orbitAscendingNodeDegrees,
        referencePoleDirection,
      )
      const orbitPlaneNormal = vec3.transformMat4(vec3.create(), [0, 0, 1], tiltMatrix) as [number, number, number]
      expect(tiltDegreesFromEclipticNorth(orbitPlaneNormal)).toBeGreaterThan(80)
    }
  })

  it("Triton's orbital plane ends up steeply inclined (retrograde) relative to Neptune's own pole", () => {
    const neptune = findPlanet('neptune')
    const triton = findMoon('triton')
    const referencePoleDirection = moonOrbitReferencePoleDirection(triton, neptune)
    const tiltMatrix = moonOrbitPlaneTiltMatrix(
      triton.orbitInclinationToParentEquatorDegrees,
      triton.orbitAscendingNodeDegrees,
      referencePoleDirection,
    )
    const orbitPlaneNormal = vec3.transformMat4(vec3.create(), [0, 0, 1], tiltMatrix)
    // Its normal should point mostly AWAY from Neptune's own pole direction (retrograde relative
    // to Neptune's rotation), i.e. the dot product with Neptune's pole is strongly negative.
    expect(vec3.dot(orbitPlaneNormal, referencePoleDirection)).toBeLessThan(-0.8)
  })

  it("the Galilean moons and Titan stay close to their parent's equatorial plane (small real inclination)", () => {
    const jupiter = findPlanet('jupiter')
    for (const moonId of ['io', 'europa', 'ganymede', 'callisto']) {
      const moon = findMoon(moonId)
      const referencePoleDirection = moonOrbitReferencePoleDirection(moon, jupiter)
      const tiltMatrix = moonOrbitPlaneTiltMatrix(
        moon.orbitInclinationToParentEquatorDegrees,
        moon.orbitAscendingNodeDegrees,
        referencePoleDirection,
      )
      const orbitPlaneNormal = vec3.transformMat4(vec3.create(), [0, 0, 1], tiltMatrix)
      expect(vec3.dot(orbitPlaneNormal, referencePoleDirection)).toBeGreaterThan(0.99)
    }
  })
})
```

- [ ] **Step 2: Run the tests to confirm they pass**

Run: `cd packages/app && npx vitest run test/axialTiltIntegration.test.ts`
Expected: PASS (6 tests) — since Tasks 1-5 are already complete by this point, these tests exercise real, already-correct data and functions; there's no red phase here.

- [ ] **Step 3: Typecheck and lint**

Run: `cd packages/app && npx tsc --noEmit`
Run: `npx eslint packages/app/test/axialTiltIntegration.test.ts` (from repo root)
Expected: no output (clean)

- [ ] **Step 4: Commit**

```bash
git add packages/app/test/axialTiltIntegration.test.ts
git commit -m "Add integration tests proving real pole/inclination data produces expected tilt geometry"
```

---

## Task 7: `main.ts` — tilt-then-spin rendering for the Sun/planets/moons, Saturn ring unification

**Files:**
- Modify: `packages/app/src/main.ts`
- Modify: `packages/app/src/solarSystem/rotation.ts` (comment only)

**Interfaces:**
- Consumes: `axisAlignmentRotation`, `equatorialToEclipticPoleDirection` from `./solarSystem/poleOrientation` (Task 1); `moonOrbitPlaneTiltMatrix`, `moonOrbitReferencePoleDirection`, `moonFlatOrbitPosition` from `./solarSystem/moonOrbit` (Task 4); the new `poleRightAscensionDegrees`/`poleDeclinationDegrees` fields (Task 2).

This is a rendering-only change: no new interactive behavior, so this task is verified primarily by the existing e2e suite (regression) plus a manual visual check, alongside the unit tests from Tasks 1-6.

- [ ] **Step 1: Update `rotation.ts`'s stale comment**

In `packages/app/src/solarSystem/rotation.ts`, the function body is unchanged; only the doc comment (currently referencing `mat4.fromYRotation` and "+Y axis") needs updating:

```typescript
// Returns the body's axial rotation angle (radians, unbounded — callers only ever feed this into
// mat4.fromZRotation, which is periodic, so it's never wrapped to [0, 2π) here) at `daysSinceEpoch`.
// A positive siderealRotationHours spins counter-clockwise looking down the +Z axis (prograde, the
// same sense as every planet's orbit) BEFORE the body's real axial tilt is applied (see
// poleOrientation.ts) - tilt happens on top of this spin, not instead of it. Negative means
// retrograde (Venus, and Uranus - see BodyDefinition.siderealRotationHours for why this sign
// stays independent of the pole-direction/tilt data rather than being derived from it).
export function rotationAngleRadians(daysSinceEpoch: number, siderealRotationHours: number): number {
  const rotationPeriodDays = siderealRotationHours / 24
  return (daysSinceEpoch / rotationPeriodDays) * 2 * Math.PI
}
```

- [ ] **Step 2: Add imports to `main.ts`**

Add a new import line, and add two names to the existing `./solarSystem/moonOrbit` import:

```typescript
import { axisAlignmentRotation, equatorialToEclipticPoleDirection } from './solarSystem/poleOrientation'
```

The existing import currently reads:

```typescript
import {
  moonOrbitAngleRadians,
  moonRelativePosition,
  moonRotationAngleRadians,
  scaledMoonOrbitRadiusUnits,
} from './solarSystem/moonOrbit'
```

Change it to:

```typescript
import {
  moonFlatOrbitPosition,
  moonOrbitAngleRadians,
  moonOrbitPlaneTiltMatrix,
  moonOrbitReferencePoleDirection,
  moonRotationAngleRadians,
  scaledMoonOrbitRadiusUnits,
} from './solarSystem/moonOrbit'
```

(`moonRelativePosition` is no longer used directly in `main.ts` after Step 6 below - the moon loop now calls `moonFlatOrbitPosition` + `moonOrbitPlaneTiltMatrix` directly so the same tilt matrix can be reused for both position and world-orientation, rather than computing it twice.)

- [ ] **Step 3: Update the Sun's world matrix (currently around line 503-509)**

Replace:

```typescript
    const sunRadius = scaledBodyRadiusUnits(SUN.radiusKm, SUN.explorerVisualRadius, scaleBlend, AU_KM)
    const sunRotation = rotationAngleRadians(daysSinceEpoch, SUN.siderealRotationHours)
    const sunWorld = mat4.multiply(
      mat4.create(),
      mat4.fromYRotation(mat4.create(), sunRotation),
      mat4.fromScaling(mat4.create(), [sunRadius, sunRadius, sunRadius]),
    )
```

with:

```typescript
    const sunRadius = scaledBodyRadiusUnits(SUN.radiusKm, SUN.explorerVisualRadius, scaleBlend, AU_KM)
    const sunRotation = rotationAngleRadians(daysSinceEpoch, SUN.siderealRotationHours)
    const sunPoleDirection = equatorialToEclipticPoleDirection(SUN.poleRightAscensionDegrees, SUN.poleDeclinationDegrees)
    const sunTilt = axisAlignmentRotation(sunPoleDirection)
    const sunWorld = mat4.multiply(
      mat4.create(),
      sunTilt,
      mat4.multiply(mat4.create(), mat4.fromZRotation(mat4.create(), sunRotation), mat4.fromScaling(mat4.create(), [sunRadius, sunRadius, sunRadius])),
    )
```

- [ ] **Step 4: Update the per-planet world matrix and Saturn's ring (currently around lines 559-591)**

Replace:

```typescript
      const rotation = rotationAngleRadians(daysSinceEpoch, renderable.definition.siderealRotationHours)
      const world = mat4.multiply(
        mat4.create(),
        mat4.fromTranslation(mat4.create(), [sx, sy, sz]),
        mat4.multiply(mat4.create(), mat4.fromYRotation(mat4.create(), rotation), mat4.fromScaling(mat4.create(), [radius, radius, radius])),
      )
```

with:

```typescript
      const rotation = rotationAngleRadians(daysSinceEpoch, renderable.definition.siderealRotationHours)
      const poleDirection = equatorialToEclipticPoleDirection(
        renderable.definition.poleRightAscensionDegrees,
        renderable.definition.poleDeclinationDegrees,
      )
      const tilt = axisAlignmentRotation(poleDirection)
      const world = mat4.multiply(
        mat4.create(),
        mat4.fromTranslation(mat4.create(), [sx, sy, sz]),
        mat4.multiply(
          mat4.create(),
          tilt,
          mat4.multiply(mat4.create(), mat4.fromZRotation(mat4.create(), rotation), mat4.fromScaling(mat4.create(), [radius, radius, radius])),
        ),
      )
```

Then replace the Saturn ring block:

```typescript
      if (renderable.definition.id === 'saturn') {
        const ringWorld = mat4.multiply(
          mat4.create(),
          mat4.fromTranslation(mat4.create(), [sx, sy, sz]),
          mat4.multiply(
            mat4.create(),
            mat4.fromXRotation(mat4.create(), SATURN_RING_TILT_RADIANS),
            mat4.fromScaling(mat4.create(), [radius, radius, radius]),
          ),
        )
```

with:

```typescript
      if (renderable.definition.id === 'saturn') {
        const ringWorld = mat4.multiply(
          mat4.create(),
          mat4.fromTranslation(mat4.create(), [sx, sy, sz]),
          mat4.multiply(mat4.create(), tilt, mat4.fromScaling(mat4.create(), [radius, radius, radius])),
        )
```

(`tilt` here is the same variable computed above for Saturn's own sphere - the ring now shares it instead of using its own hardcoded angle.)

- [ ] **Step 5: Remove the now-unused `SATURN_RING_TILT_RADIANS` constant**

Find and delete this line (currently around line 283):

```typescript
  const SATURN_RING_TILT_RADIANS = (26.73 * Math.PI) / 180
```

- [ ] **Step 6: Update the moon world matrix and position (currently around lines 599-618)**

Replace:

```typescript
        const angle = moonOrbitAngleRadians(daysSinceEpoch, moon.siderealOrbitPeriodDays)
        const orbitRadius = scaledMoonOrbitRadiusUnits(moon.orbitDistanceKm, moon.explorerOrbitVisualRadius, scaleBlend, AU_KM)
        const [rx, ry, rz] = moonRelativePosition(orbitRadius, angle)
        const [px, py, pz] = parentPosition
        const [sx, sy, sz] = [px + rx, py + ry, pz + rz]
        const radius = scaledBodyRadiusUnits(moon.radiusKm, moon.explorerVisualRadius, scaleBlend, AU_KM)
        // Tidally locked (true of every moon in this set): rotation tracks the negative of the
        // orbital angle rather than an independent sidereal rate, so the same face always faces
        // the parent (see moonRotationAngleRadians for why the sign must be negated).
        const rotation = moonRotationAngleRadians(angle)
        const world = mat4.multiply(
          mat4.create(),
          mat4.fromTranslation(mat4.create(), [sx, sy, sz]),
          mat4.multiply(mat4.create(), mat4.fromYRotation(mat4.create(), rotation), mat4.fromScaling(mat4.create(), [radius, radius, radius])),
        )
```

with:

```typescript
        const angle = moonOrbitAngleRadians(daysSinceEpoch, moon.siderealOrbitPeriodDays)
        const orbitRadius = scaledMoonOrbitRadiusUnits(moon.orbitDistanceKm, moon.explorerOrbitVisualRadius, scaleBlend, AU_KM)
        const parentDefinition = PLANETS.find((p) => p.id === moon.parentId) as BodyDefinition
        const referencePoleDirection = moonOrbitReferencePoleDirection(moon, parentDefinition)
        const moonTilt = moonOrbitPlaneTiltMatrix(
          moon.orbitInclinationToParentEquatorDegrees,
          moon.orbitAscendingNodeDegrees,
          referencePoleDirection,
        )
        const [rx, ry, rz] = vec3.transformMat4(vec3.create(), moonFlatOrbitPosition(orbitRadius, angle), moonTilt)
        const [px, py, pz] = parentPosition
        const [sx, sy, sz] = [px + rx, py + ry, pz + rz]
        const radius = scaledBodyRadiusUnits(moon.radiusKm, moon.explorerVisualRadius, scaleBlend, AU_KM)
        // Tidally locked (true of every moon in this set): rotation tracks the orbital angle
        // directly under this local-Z-spin convention (see moonRotationAngleRadians), and the
        // SAME moonTilt matrix used for position is reused here, so tidal lock holds regardless
        // of the orbital plane's real 3D tilt.
        const rotation = moonRotationAngleRadians(angle)
        const world = mat4.multiply(
          mat4.create(),
          mat4.fromTranslation(mat4.create(), [sx, sy, sz]),
          mat4.multiply(
            mat4.create(),
            moonTilt,
            mat4.multiply(mat4.create(), mat4.fromZRotation(mat4.create(), rotation), mat4.fromScaling(mat4.create(), [radius, radius, radius])),
          ),
        )
```

- [ ] **Step 7: Typecheck**

Run: `cd packages/app && npx tsc --noEmit`
Expected: no output (clean) — this is the final piece; all prior tasks' typecheck gaps should now be resolved.

- [ ] **Step 8: Run the full unit test suite**

Run: `cd packages/app && npx vitest run`
Expected: PASS across all files.

- [ ] **Step 9: Lint**

Run: `npx eslint packages/app/src/main.ts packages/app/src/solarSystem/rotation.ts` (from repo root)
Expected: no output (clean)

- [ ] **Step 10: Run the full e2e suite as a regression check**

Run: `cd packages/app && npx playwright test --workers=1`
Expected: all existing specs pass (no new specs added by this task - it's a rendering-correctness change, not new interactive behavior).

- [ ] **Step 11: Manual visual check**

Start the dev server (`npm run dev` from `packages/app`), open it in a browser, and check:
- Uranus now renders visibly tilted onto its side (not upright-and-spinning-backwards).
- Saturn's rings still look correctly tilted (should look about the same as before - 26.73° was already close to Saturn's real derived tilt, so this is a regression check, not an expected visual change for Saturn specifically).
- Search for and fly to Titania or Oberon; their orbit paths around Uranus should appear steeply inclined relative to the main solar-system plane (near-polar), not flat.
- Search for and fly to Triton; its orbit around Neptune should appear steeply inclined and retrograde.
- The Moon's orbit around Earth should look roughly similar to before (small inclination either way).

- [ ] **Step 12: Commit**

```bash
git add packages/app/src/main.ts packages/app/src/solarSystem/rotation.ts
git commit -m "Render real axial tilt for Sun/planets/moons; unify Saturn ring tilt with the sphere's own"
```

---

## Task 8: `CREDITS.md` — cite the IAU pole-orientation data source

**Files:**
- Modify: `CREDITS.md`

- [ ] **Step 1: Add a new citation section**

Insert a new section after the existing "Planetary position data (VSOP87)" section (before "Planet & Sun textures"):

```markdown
## Axial tilt & orbital-plane orientation

Each body's real rotation-axis direction (`poleRightAscensionDegrees`/`poleDeclinationDegrees` in
`packages/app/src/solarSystem/bodies.ts`) is sourced from the IAU Working Group on Cartographic
Coordinates and Rotational Elements (WGCCRE), the standard reference for planetary pole
orientations:

```
Archinal, B.A., Acton, C.H., A'Hearn, M.F. et al.
"Report of the IAU Working Group on Cartographic Coordinates and Rotational Elements: 2015."
Celestial Mechanics and Dynamical Astronomy 130, 22 (2018).
https://doi.org/10.1007/s10569-017-9805-5
```

Each moon's orbital-plane inclination relative to its parent's equator
(`orbitInclinationToParentEquatorDegrees`/`orbitAscendingNodeDegrees` in
`packages/app/src/solarSystem/moons.ts`) is sourced from Wikipedia's orbital-elements infoboxes for
each moon (themselves derived from JPL/IAU data), cross-checked at time of writing. Triton's
inclination is a representative snapshot value, not a precise unchanging constant — its real
orbital node precesses with a ~678-year period, which this app does not model (see
`docs/superpowers/specs/2026-07-19-axial-tilt-design.md`).
```

- [ ] **Step 2: Commit**

```bash
git add CREDITS.md
git commit -m "Cite IAU WGCCRE pole-orientation data source in CREDITS.md"
```

---

## Task 9: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Full workspace typecheck**

Run: `npm run typecheck` (from repo root)
Expected: clean, no errors.

- [ ] **Step 2: Full workspace lint**

Run: `npm run lint` (from repo root)
Expected: clean, no errors.

- [ ] **Step 3: Full workspace unit tests**

Run: `npm run test` (from repo root)
Expected: all tests pass across `packages/engine`, `packages/app`, `packages/data-pipeline`.

- [ ] **Step 4: Full e2e suite**

Run: `cd packages/app && npx playwright test --workers=1`
Expected: all specs pass.

- [ ] **Step 5: `CHANGELOG.md` entry**

Add to the `### Fixed` section under `[Unreleased]`:

```markdown
- Every body (Sun, planets, moons) now has a real axial tilt and rotation axis, sourced from IAU
  pole-orientation data — previously every body spun around the scene's vertical axis, which for
  planets lay *inside* their own orbital plane rather than roughly perpendicular to it. Uranus now
  visibly rolls onto its side; Saturn's ring shares the sphere's own real tilt instead of a
  separate hardcoded angle; moons' orbital planes now track their parent's real tilted equator
  (most visibly for Titan, Titania/Oberon, and Triton) instead of a fixed flat plane.
```

- [ ] **Step 6: Commit**

```bash
git add CHANGELOG.md
git commit -m "Update changelog for axial-tilt fix"
```
