import { describe, expect, it } from 'vitest'
import { circleOverlapFraction } from '../src/renderer/circleOverlap'

describe('circleOverlapFraction', () => {
  it('returns 0 when the circles are far enough apart not to touch', () => {
    expect(circleOverlapFraction(10, 5, 20)).toBe(0)
  })

  it('returns 0 when either circle has zero/negative radius', () => {
    expect(circleOverlapFraction(0, 5, 0)).toBe(0)
    expect(circleOverlapFraction(10, 0, 0)).toBe(0)
    expect(circleOverlapFraction(-1, 5, 0)).toBe(0)
  })

  it('returns 1 when circle 1 is fully covered by a larger, concentric circle 2', () => {
    expect(circleOverlapFraction(5, 10, 0)).toBeCloseTo(1, 10)
  })

  it('returns the area ratio when circle 2 is fully inside circle 1', () => {
    // A small circle 2 (radius 2) sitting entirely within a big circle 1 (radius 10) covers
    // exactly (2/10)^2 of circle 1's area.
    expect(circleOverlapFraction(10, 2, 0)).toBeCloseTo((2 / 10) ** 2, 10)
  })

  it('returns 1 for two identical, concentric circles', () => {
    expect(circleOverlapFraction(5, 5, 0)).toBeCloseTo(1, 10)
  })

  it('is between 0 and 1 for a partial overlap, increasing as circles get closer', () => {
    const far = circleOverlapFraction(10, 10, 15)
    const near = circleOverlapFraction(10, 10, 5)
    expect(far).toBeGreaterThan(0)
    expect(far).toBeLessThan(1)
    expect(near).toBeGreaterThan(far)
  })

  it('is continuous at the just-touching boundary (d = r1 + r2)', () => {
    expect(circleOverlapFraction(10, 5, 15)).toBeCloseTo(0, 6)
  })
})
