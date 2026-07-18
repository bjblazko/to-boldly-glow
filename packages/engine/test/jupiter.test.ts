import { describe, expect, it } from 'vitest'
import {
  calendarToJulianDay,
  julianMillenniaSinceJ2000,
  jupiterHeliocentricL,
  jupiterHeliocentricB,
  jupiterHeliocentricR,
} from '../build/engine.js'

function tAt(year: number, month: number, day: number): number {
  return julianMillenniaSinceJ2000(calendarToJulianDay(year, month, day))
}

describe('jupiterHeliocentric at J2000.0 (2000-01-01 12:00 UTC)', () => {
  const T = tAt(2000, 1, 1.5)

  it('matches the verified longitude', () => {
    expect(jupiterHeliocentricL(T)).toBeCloseTo(0.6335285947, 6)
  })

  it('matches the verified latitude', () => {
    expect(jupiterHeliocentricB(T)).toBeCloseTo(-0.0204340176, 6)
  })

  it('matches the verified distance', () => {
    expect(jupiterHeliocentricR(T)).toBeCloseTo(4.9640627737, 6)
  })
})

describe('jupiterHeliocentricR stays within its known perihelion-aphelion range', () => {
  it('is between 4.849 AU and 5.566 AU across a wide date range', () => {
    for (const [y, m, d] of [[1800, 3, 1], [1900, 7, 15], [2000, 1, 1], [2100, 11, 20], [2200, 5, 10]]) {
      const R = jupiterHeliocentricR(tAt(y, m, d))
      expect(R).toBeGreaterThanOrEqual(4.849)
      expect(R).toBeLessThanOrEqual(5.566)
    }
  })
})

describe('jupiterHeliocentricL', () => {
  it('stays within [0, 2*PI) across a wide date range', () => {
    for (const [y, m, d] of [[1800, 1, 1], [1950, 6, 15], [2100, 12, 31], [2200, 3, 10]]) {
      const L = jupiterHeliocentricL(tAt(y, m, d))
      expect(L).toBeGreaterThanOrEqual(0)
      expect(L).toBeLessThan(2 * Math.PI)
    }
  })
})
