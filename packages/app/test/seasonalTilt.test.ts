import { describe, expect, it } from 'vitest'
import { seasonalPoleDirection } from '../src/main'

const OBLIQUITY_RADIANS = (23.4 * Math.PI) / 180

describe('seasonalPoleDirection', () => {
  it('returns a unit vector at every phase', () => {
    for (const phase of [0, 45, 90, 135, 180, 225, 270, 315]) {
      const [x, y, z] = seasonalPoleDirection(phase)
      expect(Math.hypot(x, y, z)).toBeCloseTo(1, 9)
    }
  })

  it('at phase=0 (June solstice), the pole leans maximally along the Sun-Earth axis (local X)', () => {
    const [x, , z] = seasonalPoleDirection(0)
    expect(x).toBeCloseTo(-Math.sin(OBLIQUITY_RADIANS), 9)
    expect(z).toBeCloseTo(0, 9)
  })

  it('at phase=180 (December solstice), the X-lean is exactly reversed from phase=0', () => {
    const [xJune] = seasonalPoleDirection(0)
    const [xDecember] = seasonalPoleDirection(180)
    expect(xDecember).toBeCloseTo(-xJune, 9)
  })

  it('at phase=90 and phase=270 (equinoxes), the pole has zero lean along the Sun-Earth axis', () => {
    for (const phase of [90, 270]) {
      const [x] = seasonalPoleDirection(phase)
      expect(x).toBeCloseTo(0, 9)
    }
  })

  // The pole is deliberately confined to the X-Y plane at every phase (never leaning into Z, the
  // learn-mode camera's own depth axis) - see seasonalPoleDirection's doc comment for why: a
  // nonzero Z made an equinox's "0.0 degree" reading visually contradict itself under a real
  // perspective camera (the drawn axis line and the vertical reference line were not actually
  // parallel in 3D, only their flattened X-Y angle matched). Because Z is pinned to exactly 0, Y is
  // no longer a phase-independent constant (unlike an earlier version of this function) - it varies
  // to keep the vector unit-length: 1.0 at the equinoxes (a fully upright axis), cos(obliquity) at
  // the solstices (the same value the old constant-Y model used there too).
  it('the pole is always confined to the X-Y plane (Z is exactly 0 at every phase)', () => {
    for (const phase of [0, 45, 90, 135, 180, 225, 270, 315]) {
      const [, , z] = seasonalPoleDirection(phase)
      expect(z).toBe(0)
    }
  })

  it('Y is 1.0 at the equinoxes and cos(obliquity) at the solstices', () => {
    expect(seasonalPoleDirection(90)[1]).toBeCloseTo(1, 9)
    expect(seasonalPoleDirection(270)[1]).toBeCloseTo(1, 9)
    expect(seasonalPoleDirection(0)[1]).toBeCloseTo(Math.cos(OBLIQUITY_RADIANS), 9)
    expect(seasonalPoleDirection(180)[1]).toBeCloseTo(Math.cos(OBLIQUITY_RADIANS), 9)
  })

  // EARTH_STAGED_POSITION in main.ts places Earth on the +X side of the Sun (which sits at the
  // world origin), so the sunward direction as seen FROM Earth is -X, not +X. Subsolar latitude
  // (the latitude directly under the Sun) equals asin(dot(northPole, sunwardDirection)). This test
  // encodes that convention directly rather than trusting seasonalPoleDirection's own sign choices,
  // so a reintroduced sign inversion (which previously shipped and depicted the wrong hemisphere as
  // sunlit at both solstices) fails here even if the phase=0/180 lean-direction tests above did not
  // independently catch it.
  it('matches the sunward-facing hemisphere: June solstice favors the north, December favors the south', () => {
    const sunwardFromEarth: [number, number, number] = [-1, 0, 0]
    const dot = (a: [number, number, number], b: [number, number, number]) =>
      a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

    const juneSubsolarLatitude = Math.asin(dot(seasonalPoleDirection(0), sunwardFromEarth))
    const decemberSubsolarLatitude = Math.asin(dot(seasonalPoleDirection(180), sunwardFromEarth))

    expect(juneSubsolarLatitude).toBeGreaterThan(0)
    expect(juneSubsolarLatitude).toBeCloseTo(OBLIQUITY_RADIANS, 9)
    expect(decemberSubsolarLatitude).toBeLessThan(0)
    expect(decemberSubsolarLatitude).toBeCloseTo(-OBLIQUITY_RADIANS, 9)
  })
})
