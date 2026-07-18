import { describe, expect, it } from 'vitest'
import {
  calendarToJulianDay,
  julianMillenniaSinceJ2000,
  marsHeliocentricL,
  marsHeliocentricB,
  marsHeliocentricR,
} from '../build/engine.js'

function tAt(year: number, month: number, day: number): number {
  return julianMillenniaSinceJ2000(calendarToJulianDay(year, month, day))
}

describe('marsHeliocentric at J2000.0 (2000-01-01 12:00 UTC)', () => {
  const T = tAt(2000, 1, 1.5)

  it('matches the verified longitude', () => {
    expect(marsHeliocentricL(T)).toBeCloseTo(6.2734377406, 6)
  })

  it('matches the verified latitude', () => {
    expect(marsHeliocentricB(T)).toBeCloseTo(-0.0247022662, 6)
  })

  it('matches the verified distance', () => {
    expect(marsHeliocentricR(T)).toBeCloseTo(1.3913632910, 6)
  })
})

describe('marsHeliocentricR stays within its known perihelion-aphelion range', () => {
  it('is between 1.354 AU and 1.699 AU across a wide date range', () => {
    for (const [y, m, d] of [[1800, 3, 1], [1900, 7, 15], [2000, 1, 1], [2100, 11, 20], [2200, 5, 10]]) {
      const R = marsHeliocentricR(tAt(y, m, d))
      expect(R).toBeGreaterThanOrEqual(1.354)
      expect(R).toBeLessThanOrEqual(1.699)
    }
  })
})

describe('marsHeliocentricL', () => {
  it('stays within [0, 2*PI) across a wide date range', () => {
    for (const [y, m, d] of [[1800, 1, 1], [1950, 6, 15], [2100, 12, 31], [2200, 3, 10]]) {
      const L = marsHeliocentricL(tAt(y, m, d))
      expect(L).toBeGreaterThanOrEqual(0)
      expect(L).toBeLessThan(2 * Math.PI)
    }
  })
})
