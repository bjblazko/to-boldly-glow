import { mat4 } from 'gl-matrix'
import { describe, expect, it } from 'vitest'
import {
  equatorRingPoints,
  latitudeMarkerCenter,
  latitudeMarkerPoints,
  rotationAxisPoints,
  tiltAngleArcPoints,
  verticalReferencePoints,
} from '../src/learn/overlayGeometry'

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
    const points = latitudeMarkerPoints(identity, 1, 0, 0.05, 16)
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
    const center = latitudeMarkerCenter(identity, 1, 0)
    expect(center[0]).toBeCloseTo(0, 5)
    expect(center[1]).toBeCloseTo(1, 5)
    expect(center[2]).toBeCloseTo(0, 5)
  })

  it('verticalReferencePoints returns two points straddling center along world +Y', () => {
    const points = verticalReferencePoints([3, 0, 0], 1.5)
    expect(points.length).toBe(6)
    expect(points[0]).toBeCloseTo(3, 5)
    expect(points[1]).toBeCloseTo(-1.5, 5)
    expect(points[2]).toBeCloseTo(0, 5)
    expect(points[3]).toBeCloseTo(3, 5)
    expect(points[4]).toBeCloseTo(1.5, 5)
    expect(points[5]).toBeCloseTo(0, 5)
  })

  it('tiltAngleArcPoints starts straight up from center and sweeps toward +X for a positive angle', () => {
    const angle = (23.4 * Math.PI) / 180
    const points = tiltAngleArcPoints([3, 0, 0], 2, angle, 16)
    expect(points.length).toBe((16 + 1) * 3)
    // First point: angle=0, straight up from center.
    expect(points[0]).toBeCloseTo(3, 5)
    expect(points[1]).toBeCloseTo(2, 5)
    expect(points[2]).toBeCloseTo(0, 5)
    // Last point: the full swept angle - x moves toward +X, y shrinks from the full radius.
    const lastX = points[16 * 3]
    const lastY = points[16 * 3 + 1]
    expect(lastX).toBeCloseTo(3 + 2 * Math.sin(angle), 5)
    expect(lastY).toBeCloseTo(2 * Math.cos(angle), 5)
    expect(lastX).toBeGreaterThan(3) // swept toward +X, not -X
    // Every point stays at exactly `radius` from center (a true circular arc).
    for (let i = 0; i <= 16; i++) {
      const dx = points[i * 3] - 3
      const dy = points[i * 3 + 1] - 0
      expect(Math.hypot(dx, dy)).toBeCloseTo(2, 5)
    }
  })

  it('tiltAngleArcPoints sweeps toward -X for a negative angle', () => {
    const points = tiltAngleArcPoints([0, 0, 0], 1, -0.5, 8)
    const lastX = points[8 * 3]
    expect(lastX).toBeLessThan(0)
  })
})
