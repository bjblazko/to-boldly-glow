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
    expect(x).toBeCloseTo(Math.sin(OBLIQUITY_RADIANS), 9)
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

  it('the Y-component (base tilt magnitude) is constant across every phase', () => {
    const ys = [0, 90, 180, 270].map((phase) => seasonalPoleDirection(phase)[1])
    for (const y of ys) {
      expect(y).toBeCloseTo(Math.cos(OBLIQUITY_RADIANS), 9)
    }
  })
})
