import { describe, expect, it } from 'vitest'
import { calendarToJulianDay, daysSinceJ2000, julianMillenniaSinceJ2000 } from '../build/engine.js'

describe('calendarToJulianDay', () => {
  it('matches the J2000.0 epoch (2000-01-01 12:00 UTC = JD 2451545.0)', () => {
    expect(calendarToJulianDay(2000, 1, 1.5)).toBeCloseTo(2451545.0, 6)
  })

  it('matches the Unix epoch (1970-01-01 00:00 UTC = JD 2440587.5)', () => {
    expect(calendarToJulianDay(1970, 1, 1.0)).toBeCloseTo(2440587.5, 6)
  })

  it('matches the Modified Julian Date epoch (1858-11-17 00:00 UTC = JD 2400000.5)', () => {
    expect(calendarToJulianDay(1858, 11, 17.0)).toBeCloseTo(2400000.5, 6)
  })
})

describe('daysSinceJ2000', () => {
  it('is zero at the J2000.0 epoch', () => {
    expect(daysSinceJ2000(2451545.0)).toBeCloseTo(0, 6)
  })

  it('is negative before J2000.0', () => {
    expect(daysSinceJ2000(2440587.5)).toBeCloseTo(2440587.5 - 2451545.0, 6)
  })
})

describe('julianMillenniaSinceJ2000', () => {
  it('is zero at the J2000.0 epoch', () => {
    expect(julianMillenniaSinceJ2000(2451545.0)).toBeCloseTo(0, 10)
  })

  it('is one Julian millennium (365250 days) after J2000.0', () => {
    expect(julianMillenniaSinceJ2000(2451545.0 + 365250.0)).toBeCloseTo(1.0, 10)
  })
})
