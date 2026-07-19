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
      expect(transformed[0]).toBeCloseTo(direction[0], 6)
      expect(transformed[1]).toBeCloseTo(direction[1], 6)
      expect(transformed[2]).toBeCloseTo(direction[2], 6)
    }
  })
})
