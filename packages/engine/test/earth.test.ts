import { describe, expect, it } from 'vitest'
import {
  calendarToJulianDay,
  julianMillenniaSinceJ2000,
  earthHeliocentricL,
  earthHeliocentricB,
  earthHeliocentricR,
} from '../build/engine.js'

function tAt(year: number, month: number, day: number): number {
  return julianMillenniaSinceJ2000(calendarToJulianDay(year, month, day))
}

describe('earthHeliocentric at J2000.0 (2000-01-01 12:00 UTC)', () => {
  const T = tAt(2000, 1, 1.5)

  it('matches the verified longitude', () => {
    expect(earthHeliocentricL(T)).toBeCloseTo(1.7519222494, 8)
  })

  it('matches the verified latitude', () => {
    expect(earthHeliocentricB(T)).toBeCloseTo(-0.0000040065, 8)
  })

  it('matches the verified distance', () => {
    expect(earthHeliocentricR(T)).toBeCloseTo(0.9833273703, 8)
  })
})

describe('earthHeliocentricR at known perihelion and aphelion dates', () => {
  it('is close to the published perihelion distance (~0.98329 AU) near 2000-01-03', () => {
    const T = tAt(2000, 1, 3.0)
    expect(earthHeliocentricR(T)).toBeCloseTo(0.9833212288, 6)
  })

  it('is close to the published aphelion distance (~1.01671 AU) near 2000-07-04', () => {
    const T = tAt(2000, 7, 4.0)
    expect(earthHeliocentricR(T)).toBeCloseTo(1.0167404533, 6)
  })

  it('is smaller at perihelion than at aphelion', () => {
    const perihelion = earthHeliocentricR(tAt(2000, 1, 3.0))
    const aphelion = earthHeliocentricR(tAt(2000, 7, 4.0))
    expect(perihelion).toBeLessThan(aphelion)
  })
})

describe('earthHeliocentricL', () => {
  it('stays within [0, 2*PI) across a wide date range', () => {
    for (const [y, m, d] of [[1800, 1, 1], [1950, 6, 15], [2100, 12, 31], [2200, 3, 10]]) {
      const L = earthHeliocentricL(tAt(y, m, d))
      expect(L).toBeGreaterThanOrEqual(0)
      expect(L).toBeLessThan(2 * Math.PI)
    }
  })
})
