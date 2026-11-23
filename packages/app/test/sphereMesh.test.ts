import { describe, expect, it } from 'vitest'
import { FINE_SPHERE_SEGMENTS, needsFineSphere } from '../src/bodies/sphereMesh'

describe('the fine sphere for a body close by', () => {
  it('is used in low orbit, not from afar', () => {
    expect(needsFineSphere(6378 + 190, 6378)).toBe(true)
    expect(needsFineSphere(384_400, 6378)).toBe(false)
  })

  it('keeps its facets so shallow that a low orbit sees a round horizon (under half a kilometre on Earth)', () => {
    expect(6378 * (1 - Math.cos(Math.PI / FINE_SPHERE_SEGMENTS))).toBeLessThan(0.5)
  })
})
