import { describe, expect, it } from 'vitest'
import {
  calendarToJulianDay,
  julianMillenniaSinceJ2000,
  uranusHeliocentricL,
  uranusHeliocentricB,
  uranusHeliocentricR,
} from '../build/engine.js'

function tAt(year: number, month: number, day: number): number {
  return julianMillenniaSinceJ2000(calendarToJulianDay(year, month, day))
}

describe('uranusHeliocentric at J2000.0 (2000-01-01 12:00 UTC)', () => {
  const T = tAt(2000, 1, 1.5)

  it('matches the verified longitude', () => {
    expect(uranusHeliocentricL(T)).toBeCloseTo(5.5223729051, 6)
  })

  it('matches the verified latitude', () => {
    expect(uranusHeliocentricB(T)).toBeCloseTo(-0.0120557001, 6)
  })

  it('matches the verified distance', () => {
    expect(uranusHeliocentricR(T)).toBeCloseTo(19.9247284136, 6)
  })
})

describe('uranusHeliocentricR stays within its known perihelion-aphelion range', () => {
  it('is between 17.918 AU and 20.505 AU across a wide date range', () => {
    for (const [y, m, d] of [[1800, 3, 1], [1900, 7, 15], [2000, 1, 1], [2100, 11, 20], [2200, 5, 10]]) {
      const R = uranusHeliocentricR(tAt(y, m, d))
      expect(R).toBeGreaterThanOrEqual(17.918)
      expect(R).toBeLessThanOrEqual(20.505)
    }
  })
})

describe('uranusHeliocentricL', () => {
  it('stays within [0, 2*PI) across a wide date range', () => {
    for (const [y, m, d] of [[1800, 1, 1], [1950, 6, 15], [2100, 12, 31], [2200, 3, 10]]) {
      const L = uranusHeliocentricL(tAt(y, m, d))
      expect(L).toBeGreaterThanOrEqual(0)
      expect(L).toBeLessThan(2 * Math.PI)
    }
  })
})
