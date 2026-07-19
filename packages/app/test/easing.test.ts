import { describe, expect, it } from 'vitest'
import { easeInOutCubic, lerp, lerpAngle, lerpVec3 } from '../src/camera/easing'

describe('easeInOutCubic', () => {
  it('starts at 0 and ends at 1', () => {
    expect(easeInOutCubic(0)).toBe(0)
    expect(easeInOutCubic(1)).toBe(1)
  })

  it('is symmetric around the midpoint', () => {
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 10)
  })

  it('is monotonically increasing across [0, 1]', () => {
    let previous = -Infinity
    for (let t = 0; t <= 1; t += 0.05) {
      const value = easeInOutCubic(t)
      expect(value).toBeGreaterThanOrEqual(previous)
      previous = value
    }
  })
})

describe('lerp', () => {
  it('returns a at t=0 and b at t=1', () => {
    expect(lerp(10, 20, 0)).toBe(10)
    expect(lerp(10, 20, 1)).toBe(20)
  })

  it('returns the midpoint at t=0.5', () => {
    expect(lerp(10, 20, 0.5)).toBe(15)
  })
})

describe('lerpAngle', () => {
  it('behaves like a plain lerp when there is no wraparound', () => {
    expect(lerpAngle(0, 1, 0.5)).toBeCloseTo(0.5, 10)
    expect(lerpAngle(0.2, 0.8, 0)).toBeCloseTo(0.2, 10)
    expect(lerpAngle(0.2, 0.8, 1)).toBeCloseTo(0.8, 10)
  })

  it('takes the short way around the 2*PI boundary instead of the long way', () => {
    // From just below 2*PI to just above 0 is a short hop forward across the seam, not a long
    // sweep backward through the middle.
    const a = 2 * Math.PI - 0.1
    const b = 0.1
    const mid = lerpAngle(a, b, 0.5)
    // The short-way midpoint is exactly at the seam (angle 0 / 2*PI); reduce for comparison.
    const normalizedMid = ((mid % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
    expect(Math.min(normalizedMid, 2 * Math.PI - normalizedMid)).toBeCloseTo(0, 10)
  })

  it('reaches the target angle exactly at t=1, even across a wraparound', () => {
    const a = 2 * Math.PI - 0.1
    const b = 0.1
    const result = lerpAngle(a, b, 1)
    const normalized = ((result % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
    expect(normalized).toBeCloseTo(0.1, 10)
  })
})

describe('lerpVec3', () => {
  it('interpolates each component independently', () => {
    const result = lerpVec3([0, 0, 0], [10, -20, 4], 0.25)
    expect(result[0]).toBeCloseTo(2.5, 10)
    expect(result[1]).toBeCloseTo(-5, 10)
    expect(result[2]).toBeCloseTo(1, 10)
  })
})
