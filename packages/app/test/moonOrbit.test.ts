import { mat4, vec3 } from 'gl-matrix'
import { describe, expect, it } from 'vitest'
import {
  moonOrbitAngleRadians,
  moonRelativePosition,
  moonRotationAngleRadians,
  scaledMoonOrbitRadiusUnits,
} from '../src/solarSystem/moonOrbit'
import { AU_TO_SCENE_UNITS } from '../src/solarSystem/sceneScale'

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

describe('moonRelativePosition', () => {
  it('stays at a constant distance from the parent for any angle', () => {
    const orbitRadius = 1.7
    for (const angle of [0, Math.PI / 4, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
      const [x, y, z] = moonRelativePosition(orbitRadius, angle)
      expect(Math.hypot(x, y, z)).toBeCloseTo(orbitRadius, 10)
    }
  })

  it('stays in the parent-local XZ plane (y=0), consistent with no inclination modeled', () => {
    const [, y] = moonRelativePosition(1.7, 1.234)
    expect(y).toBe(0)
  })
})

describe('tidal lock: moonRotationAngleRadians combined with moonRelativePosition', () => {
  // Reproduces exactly how main.ts builds a moon's world matrix (fromTranslation combined with
  // fromYRotation(rotation)), then checks whether a fixed local reference point (local +Z, once
  // rotated) maintains a CONSTANT angular offset from the true parent direction across a full
  // orbit. Real tidal lock doesn't require +Z specifically to point at the parent (this app has
  // no real prime-meridian data, so which exact meridian faces the parent is arbitrary/cosmetic) -
  // what defines tidal lock is that the offset never drifts. A drifting offset means the moon
  // sweeps through extra rotations relative to the parent-facing direction, i.e. shows different
  // faces over the orbit instead of keeping one locked.
  function planarAngle(v: vec3): number {
    return Math.atan2(v[0], v[2])
  }

  function nearSideOffsetFromParent(angle: number, orbitRadius: number): number {
    const relativePosition = moonRelativePosition(orbitRadius, angle)
    const directionToParent = vec3.normalize(vec3.create(), vec3.negate(vec3.create(), relativePosition))
    const rotation = moonRotationAngleRadians(angle)
    const rotationMatrix = mat4.fromYRotation(mat4.create(), rotation)
    const nearSideDirection = vec3.transformMat4(vec3.create(), [0, 0, 1], rotationMatrix)
    return planarAngle(nearSideDirection) - planarAngle(directionToParent)
  }

  it('holds a constant angular offset from the parent-facing direction across a full orbit', () => {
    const orbitRadius = 1.7
    const angles = [0, Math.PI / 6, Math.PI / 2, Math.PI, (4 * Math.PI) / 3, 1.9 * Math.PI]
    const offsets = angles.map((angle) => nearSideOffsetFromParent(angle, orbitRadius))
    const [first, ...rest] = offsets
    for (const offset of rest) {
      // Compare via sin/cos rather than the raw angle, since the raw offset can legitimately wrap
      // across a +-PI boundary between samples while still representing the same constant angle.
      expect(Math.sin(offset)).toBeCloseTo(Math.sin(first), 6)
      expect(Math.cos(offset)).toBeCloseTo(Math.cos(first), 6)
    }
  })
})
