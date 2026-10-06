import { mat4 } from 'gl-matrix'
import { describe, expect, it } from 'vitest'
import {
  equatorRingPoints,
  latitudeMarkerCenter,
  latitudeMarkerPoints,
  meridianLongitudeFacing,
  rotationAxisPoints,
  sunLeanLabel,
} from '../src/learn/seasons/overlayGeometry'
import { axisAlignmentRotation } from '../src/solarSystem/poleOrientation'

describe('overlay geometry (identity world transform, radius 1)', () => {
  const identity = mat4.create()

  it('equatorRingPoints traces a closed loop of radius `radius` in the local XY plane', () => {
    const points = equatorRingPoints(identity, 1, 32)
    expect(points.length).toBe((32 + 1) * 3) // closed loop: first point repeated at the end
    for (let i = 0; i <= 32; i++) {
      const x = points[i * 3]
      const y = points[i * 3 + 1]
      const z = points[i * 3 + 2]
      expect(Math.hypot(x, y)).toBeCloseTo(1, 5)
      expect(z).toBeCloseTo(0, 5)
    }
    // First and last point coincide (closed loop).
    expect(points[0]).toBeCloseTo(points[32 * 3], 5)
    expect(points[1]).toBeCloseTo(points[32 * 3 + 1], 5)
  })

  it('rotationAxisPoints returns two points along local +Z, extending past the poles', () => {
    const points = rotationAxisPoints(identity, 1, 1.3)
    expect(points.length).toBe(6)
    expect(points[0]).toBeCloseTo(0, 5)
    expect(points[1]).toBeCloseTo(0, 5)
    expect(points[2]).toBeCloseTo(-1.3, 5)
    expect(points[3]).toBeCloseTo(0, 5)
    expect(points[4]).toBeCloseTo(0, 5)
    expect(points[5]).toBeCloseTo(1.3, 5)
  })

  it('latitudeMarkerPoints places a small closed loop centered on the surface point for the given latitude', () => {
    // Equator (0 degrees): surface point should lie in the local XY plane (z ~ 0).
    const points = latitudeMarkerPoints(identity, { surfaceRadius: 1, latitudeDegrees: 0 }, { radius: 0.05, segments: 16 })
    expect(points.length).toBe((16 + 1) * 3)
    // The loop's average position should be close to the equator surface point (1, 0, 0) at
    // longitude 0 - not exact, since it's a ring around that point, but within markerRadius.
    let sumX = 0, sumY = 0, sumZ = 0
    for (let i = 0; i < 16; i++) {
      sumX += points[i * 3]
      sumY += points[i * 3 + 1]
      sumZ += points[i * 3 + 2]
    }
    expect(sumX / 16).toBeCloseTo(0, 1)
    expect(sumY / 16).toBeGreaterThan(0.9) // clusters near y=1 (the equator surface point at longitude 0)
    expect(sumZ / 16).toBeCloseTo(0, 1)
  })

  it('latitudeMarkerCenter returns the exact surface point a latitude marker ring is centered on', () => {
    // Equator (0 degrees) at radius 1, longitude 0: the exact surface point is (0, 1, 0) - unlike
    // latitudeMarkerPoints' own ring vertices, this isn't an average/approximation.
    const center = latitudeMarkerCenter(identity, { surfaceRadius: 1, latitudeDegrees: 0 })
    expect(center[0]).toBeCloseTo(0, 5)
    expect(center[1]).toBeCloseTo(1, 5)
    expect(center[2]).toBeCloseTo(0, 5)
  })
})

describe('meridianLongitudeFacing', () => {
  it('returns the longitude whose surface point faces the given world direction, for any tilt', () => {
    const tilts: Array<[number, number, number]> = [
      [0, 0, 1],
      [-0.397, 0.918, 0],
      [-0.281, 0.918, -0.281],
      [0.2, 0.9, 0.387],
    ]
    const facing: [number, number, number] = [-Math.cos(Math.PI / 6), 0, -Math.sin(Math.PI / 6)]
    for (const raw of tilts) {
      const length = Math.hypot(...raw)
      const pole: [number, number, number] = [raw[0] / length, raw[1] / length, raw[2] / length]
      const tilt = axisAlignmentRotation(pole)
      const longitude = meridianLongitudeFacing(tilt, facing)
      // The equator point at that longitude must lie in the plane spanned by the pole and `facing`,
      // on the `facing` side: its direction equals facing's component perpendicular to the pole.
      const equatorPoint = latitudeMarkerCenter(tilt, { surfaceRadius: 1, latitudeDegrees: 0, longitudeDegrees: longitude })
      const along = facing[0] * pole[0] + facing[1] * pole[1] + facing[2] * pole[2]
      const expected = [facing[0] - along * pole[0], facing[1] - along * pole[1], facing[2] - along * pole[2]]
      const expectedLength = Math.hypot(expected[0], expected[1], expected[2])
      for (let k = 0; k < 3; k++) expect(equatorPoint[k]).toBeCloseTo(expected[k] / expectedLength, 5)
    }
  })
})

describe('sunLeanLabel', () => {
  it('reports the lean toward or away from the Sun, and calls zero sideways', () => {
    expect(sunLeanLabel((23.4 * Math.PI) / 180)).toBe('23.4° toward the Sun')
    expect(sunLeanLabel((-23.4 * Math.PI) / 180)).toBe('23.4° away from the Sun')
    expect(sunLeanLabel((16.31 * Math.PI) / 180)).toBe('16.3° toward the Sun')
    expect(sunLeanLabel(0)).toBe('0.0° (tilt points sideways)')
    expect(sunLeanLabel(-0.0001)).toBe('0.0° (tilt points sideways)')
  })
})
