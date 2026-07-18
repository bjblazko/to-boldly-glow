import { describe, expect, it } from 'vitest'
import {
  calendarToJulianDay,
  julianMillenniaSinceJ2000,
  venusHeliocentricL,
  venusHeliocentricB,
  venusHeliocentricR,
} from '../build/engine.js'

function tAt(year: number, month: number, day: number): number {
  return julianMillenniaSinceJ2000(calendarToJulianDay(year, month, day))
}

describe('venusHeliocentric at J2000.0 (2000-01-01 12:00 UTC)', () => {
  const T = tAt(2000, 1, 1.5)

  it('matches the verified longitude', () => {
    expect(venusHeliocentricL(T)).toBeCloseTo(3.1870918350, 6)
  })

  it('matches the verified latitude', () => {
    expect(venusHeliocentricB(T)).toBeCloseTo(0.0569736619, 6)
  })

  it('matches the verified distance', () => {
    expect(venusHeliocentricR(T)).toBeCloseTo(0.7202301341, 6)
  })
})

describe('venusHeliocentricR stays within its known perihelion-aphelion range', () => {
  it('is between 0.704 AU and 0.743 AU across a wide date range', () => {
    for (const [y, m, d] of [[1800, 3, 1], [1900, 7, 15], [2000, 1, 1], [2100, 11, 20], [2200, 5, 10]]) {
      const R = venusHeliocentricR(tAt(y, m, d))
      expect(R).toBeGreaterThanOrEqual(0.704)
      expect(R).toBeLessThanOrEqual(0.743)
    }
  })
})

describe('venusHeliocentricL', () => {
  it('stays within [0, 2*PI) across a wide date range', () => {
    for (const [y, m, d] of [[1800, 1, 1], [1950, 6, 15], [2100, 12, 31], [2200, 3, 10]]) {
      const L = venusHeliocentricL(tAt(y, m, d))
      expect(L).toBeGreaterThanOrEqual(0)
      expect(L).toBeLessThan(2 * Math.PI)
    }
  })
})
