import { describe, expect, it } from 'vitest'
import {
  calendarToJulianDay,
  julianMillenniaSinceJ2000,
  saturnHeliocentricL,
  saturnHeliocentricB,
  saturnHeliocentricR,
} from '../build/engine.js'

function tAt(year: number, month: number, day: number): number {
  return julianMillenniaSinceJ2000(calendarToJulianDay(year, month, day))
}

describe('saturnHeliocentric at J2000.0 (2000-01-01 12:00 UTC)', () => {
  const T = tAt(2000, 1, 1.5)

  it('matches the verified longitude', () => {
    expect(saturnHeliocentricL(T)).toBeCloseTo(0.7980183004, 6)
  })

  it('matches the verified latitude', () => {
    expect(saturnHeliocentricB(T)).toBeCloseTo(-0.0402412610, 6)
  })

  it('matches the verified distance', () => {
    expect(saturnHeliocentricR(T)).toBeCloseTo(9.1828795044, 6)
  })
})

describe('saturnHeliocentricR stays within its known perihelion-aphelion range', () => {
  it('is between 8.832 AU and 10.271 AU across a wide date range', () => {
    for (const [y, m, d] of [[1800, 3, 1], [1900, 7, 15], [2000, 1, 1], [2100, 11, 20], [2200, 5, 10]]) {
      const R = saturnHeliocentricR(tAt(y, m, d))
      expect(R).toBeGreaterThanOrEqual(8.832)
      expect(R).toBeLessThanOrEqual(10.271)
    }
  })
})

describe('saturnHeliocentricL', () => {
  it('stays within [0, 2*PI) across a wide date range', () => {
    for (const [y, m, d] of [[1800, 1, 1], [1950, 6, 15], [2100, 12, 31], [2200, 3, 10]]) {
      const L = saturnHeliocentricL(tAt(y, m, d))
      expect(L).toBeGreaterThanOrEqual(0)
      expect(L).toBeLessThan(2 * Math.PI)
    }
  })
})
