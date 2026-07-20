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

  it('interpolates geometrically (matching scaledBodyRadiusUnits) between the two endpoints', () => {
    const orbitDistanceKm = 384_400
    const explorerRadius = 1.7
    const realistic = (orbitDistanceKm / AU_KM) * AU_TO_SCENE_UNITS
    const atHalf = scaledMoonOrbitRadiusUnits(orbitDistanceKm, explorerRadius, 0.5, AU_KM)
    expect(atHalf).toBeCloseTo(Math.sqrt(realistic * explorerRadius), 10)
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
    // Precision 6, not 10: matches the same non-trivial-direction precedent set in
    // poleOrientation.test.ts's axisAlignmentRotation tests — gl-matrix's mat4/quat default to
    // Float32Array, so any non-identity rotation carries ~1e-7 rounding error.
    const normal = vec3.transformMat4(vec3.create(), [0, 0, 1], matrix)
    expect(normal[0]).toBeCloseTo(reference[0], 6)
    expect(normal[1]).toBeCloseTo(reference[1], 6)
    expect(normal[2]).toBeCloseTo(reference[2], 6)
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
      // Precision 6, not 10: this composes a non-trivial rotation (inclination + node), so it
      // carries the same gl-matrix Float32Array rounding as above.
      expect(Math.hypot(x, y, z)).toBeCloseTo(orbitRadius, 6)
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
