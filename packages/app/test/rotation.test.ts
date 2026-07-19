import { describe, expect, it } from 'vitest'
import { rotationAngleRadians } from '../src/solarSystem/rotation'

describe('rotationAngleRadians', () => {
  it('is zero at the epoch', () => {
    expect(rotationAngleRadians(0, 23.9345)).toBe(0)
  })

  it('completes exactly one full turn after one rotation period', () => {
    const rotationHours = 23.9345
    const oneFullPeriodDays = rotationHours / 24
    expect(rotationAngleRadians(oneFullPeriodDays, rotationHours)).toBeCloseTo(2 * Math.PI, 10)
  })

  it('is positive (prograde) for a positive rotation period', () => {
    expect(rotationAngleRadians(1, 23.9345)).toBeGreaterThan(0)
  })

  it('is negative (retrograde) for a negative rotation period', () => {
    expect(rotationAngleRadians(1, -5832.5)).toBeLessThan(0)
  })

  it('scales linearly with elapsed time', () => {
    const rotationHours = 9.925
    const angleAt10Days = rotationAngleRadians(10, rotationHours)
    const angleAt20Days = rotationAngleRadians(20, rotationHours)
    expect(angleAt20Days).toBeCloseTo(angleAt10Days * 2, 10)
  })
})
