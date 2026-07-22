import { describe, expect, it } from 'vitest'
import {
  angleBetweenDirections,
  directedLinePoints,
  greatCircleArcPoints,
  orbitPathCirclePoints,
  orbitPositionForPhase,
  perpendicularComponent,
} from '../src/learn/overlayGeometry'
import { ORBIT_FIXED_POLE_DIRECTION } from '../src/main'

describe('orbitPositionForPhase', () => {
  it('places Earth on a circle of the given radius, at the angle equal to the phase itself', () => {
    const expectedUnitDirections: Record<number, [number, number, number]> = {
      0: [1, 0, 0],
      90: [0, 1, 0],
      180: [-1, 0, 0],
      270: [0, -1, 0],
    }
    for (const [phase, expected] of Object.entries(expectedUnitDirections)) {
      const [x, y, z] = orbitPositionForPhase(Number(phase), 5)
      expect(x).toBeCloseTo(expected[0] * 5, 9)
      expect(y).toBeCloseTo(expected[1] * 5, 9)
      expect(z).toBeCloseTo(0, 9)
    }
  })
})

describe('orbitPathCirclePoints', () => {
  it('traces a closed loop of the given radius in the world X-Y plane', () => {
    const points = orbitPathCirclePoints(5, 32)
    expect(points.length).toBe((32 + 1) * 3)
    for (let i = 0; i <= 32; i++) {
      // Precision 5 here (not 9, unlike this file's other assertions): these values round-trip
      // through a Float32Array (~1e-7 precision), matching the identical radius check's own
      // tolerance in test/overlayGeometry.test.ts.
      expect(Math.hypot(points[i * 3], points[i * 3 + 1])).toBeCloseTo(5, 5)
      expect(points[i * 3 + 2]).toBeCloseTo(0, 9)
    }
    expect(points[0]).toBeCloseTo(points[32 * 3], 9)
    expect(points[1]).toBeCloseTo(points[32 * 3 + 1], 9)
  })
})

describe('directedLinePoints', () => {
  it('returns two points straddling center, `length` apart in each direction along `direction`', () => {
    const points = directedLinePoints([2, 0, 0], [0, 1, 0], 3)
    expect(points.length).toBe(6)
    expect(points[0]).toBeCloseTo(2, 9)
    expect(points[1]).toBeCloseTo(-3, 9)
    expect(points[2]).toBeCloseTo(0, 9)
    expect(points[3]).toBeCloseTo(2, 9)
    expect(points[4]).toBeCloseTo(3, 9)
    expect(points[5]).toBeCloseTo(0, 9)
  })

  it('normalizes a non-unit direction vector first', () => {
    const points = directedLinePoints([0, 0, 0], [0, 2, 0], 1)
    expect(points[4]).toBeCloseTo(1, 9)
  })
})

describe('greatCircleArcPoints', () => {
  it('starts at fromDirection and ends at toDirection, staying at radius from center throughout', () => {
    const points = greatCircleArcPoints([1, 1, 1], [1, 0, 0], [0, 1, 0], 2, 16)
    expect(points[0]).toBeCloseTo(1 + 2, 9)
    expect(points[1]).toBeCloseTo(1, 9)
    expect(points[2]).toBeCloseTo(1, 9)
    const lastX = points[16 * 3]
    const lastY = points[16 * 3 + 1]
    expect(lastX).toBeCloseTo(1, 9)
    expect(lastY).toBeCloseTo(1 + 2, 9)
    for (let i = 0; i <= 16; i++) {
      const dx = points[i * 3] - 1
      const dy = points[i * 3 + 1] - 1
      const dz = points[i * 3 + 2] - 1
      // Precision 5 here for the same Float32Array round-trip reason as orbitPathCirclePoints'
      // own radius check above.
      expect(Math.hypot(dx, dy, dz)).toBeCloseTo(2, 5)
    }
  })

  it('returns every point at fromDirection when the two directions already coincide', () => {
    const points = greatCircleArcPoints([0, 0, 0], [1, 0, 0], [1, 0, 0], 1, 8)
    for (let i = 0; i <= 8; i++) {
      expect(points[i * 3]).toBeCloseTo(1, 9)
      expect(points[i * 3 + 1]).toBeCloseTo(0, 9)
      expect(points[i * 3 + 2]).toBeCloseTo(0, 9)
    }
  })
})

describe('angleBetweenDirections', () => {
  it('returns 0 for identical directions and PI for opposite ones', () => {
    expect(angleBetweenDirections([1, 0, 0], [1, 0, 0])).toBeCloseTo(0, 9)
    expect(angleBetweenDirections([1, 0, 0], [-1, 0, 0])).toBeCloseTo(Math.PI, 9)
  })

  it('returns PI/2 for perpendicular directions', () => {
    expect(angleBetweenDirections([1, 0, 0], [0, 1, 0])).toBeCloseTo(Math.PI / 2, 9)
  })

  it('normalizes non-unit inputs first', () => {
    expect(angleBetweenDirections([5, 0, 0], [0, 3, 0])).toBeCloseTo(Math.PI / 2, 9)
  })
})

describe('ORBIT_FIXED_POLE_DIRECTION', () => {
  it('is a unit vector', () => {
    const [x, y, z] = ORBIT_FIXED_POLE_DIRECTION
    expect(Math.hypot(x, y, z)).toBeCloseTo(1, 9)
  })

  // The whole pedagogical point of the orbit chapters: the SAME fixed axis, combined with the
  // Sun-Earth direction at each of the four orbit phases, reproduces the exact 23.4/0-degree
  // pattern the staged chapters already show via a completely different mechanism (a rotating
  // axis at a fixed position, instead of a fixed axis at a rotating position).
  it('reproduces the 23.4/0-degree sequence at the four orbit-chapter phases', () => {
    const orbitRadius = 5
    const expectedDegrees: Record<number, number> = { 0: 23.4, 90: 0, 180: 23.4, 270: 0 }
    for (const [phase, expected] of Object.entries(expectedDegrees)) {
      const earthPosition = orbitPositionForPhase(Number(phase), orbitRadius)
      const sunward: [number, number, number] = [-earthPosition[0], -earthPosition[1], -earthPosition[2]]
      const angleRadians = angleBetweenDirections(ORBIT_FIXED_POLE_DIRECTION, sunward)
      const angleDegrees = (angleRadians * 180) / Math.PI
      // The angle between the fixed axis and the sunward direction is 90 degrees at the equinoxes
      // (axis perpendicular to the Sun line) and 90 +/- 23.4 degrees at the solstices - expressed
      // here as "how far from perpendicular", which is exactly the obliquity at the solstices and
      // 0 at the equinoxes, matching seasonalTilt.test.ts's own subsolar-latitude-style check.
      expect(Math.abs(90 - angleDegrees)).toBeCloseTo(expected, 5)
    }
  })
})

describe('perpendicularComponent', () => {
  it('removes the reference-aligned component, leaving a unit vector perpendicular to it', () => {
    const result = perpendicularComponent([1, 1, 0], [0, 1, 0])
    expect(result[0]).toBeCloseTo(1, 9)
    expect(result[1]).toBeCloseTo(0, 9)
    expect(result[2]).toBeCloseTo(0, 9)
  })

  it('returns the vector unchanged (normalized) when it is already perpendicular to the reference', () => {
    const result = perpendicularComponent([2, 0, 0], [0, 1, 0])
    expect(result[0]).toBeCloseTo(1, 9)
    expect(result[1]).toBeCloseTo(0, 9)
    expect(result[2]).toBeCloseTo(0, 9)
  })
})
