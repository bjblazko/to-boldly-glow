import { describe, expect, it } from 'vitest'
import { eccentricAnomaly, heliocentricPosition, motionDirection, orbitalPeriodDays, sampleOrbit } from '../src/smallBodies/keplerOrbit'
import { COMETS, MINOR_PLANETS, SMALL_BODIES } from '../src/smallBodies/smallBodyCatalog'

const byId = (id: string) => SMALL_BODIES.find((body) => body.id === id)!
const daysSinceJ2000 = (date: string) => (Date.parse(date) - Date.UTC(2000, 0, 1, 12)) / 86400000

describe('eccentricAnomaly', () => {
  it('solves Kepler’s equation, even for a near-parabolic orbit', () => {
    for (const e of [0, 0.1, 0.6, 0.967, 0.9992]) {
      for (const M of [-3, -0.5, 0.001, 0.4, 2.9]) {
        const E = eccentricAnomaly(M, e)
        expect(E - e * Math.sin(E)).toBeCloseTo(M, 9)
      }
    }
  })
})

describe('heliocentricPosition', () => {
  it('puts Halley at its perihelion distance in February 1986 and far beyond Neptune in 2023', () => {
    const halley = byId('halley').orbit
    expect(heliocentricPosition(halley, daysSinceJ2000('1986-02-09T11:00Z')).distanceAu).toBeCloseTo(0.586, 3)
    expect(heliocentricPosition(halley, daysSinceJ2000('2023-12-09T00:00Z')).distanceAu).toBeGreaterThan(34)
  })

  it('takes Halley about 75 years per orbit', () => {
    expect(orbitalPeriodDays(byId('halley').orbit.semiMajorAxisAu) / 365.25).toBeCloseTo(75.3, 0)
  })

  it('keeps Pluto between 29.6 and 49.3 AU, and about 35.5 AU from the Sun in 2026', () => {
    const pluto = byId('pluto').orbit
    const distances = sampleOrbit(pluto, 64).map((point) => point.distanceAu)
    expect(Math.min(...distances)).toBeCloseTo(29.66, 1)
    expect(Math.max(...distances)).toBeCloseTo(49.3, 0)
    expect(heliocentricPosition(pluto, daysSinceJ2000('2026-10-06T00:00Z')).distanceAu).toBeCloseTo(35.5, 0)
  })

  it('lifts a body above the ecliptic only as far as its inclination allows', () => {
    const pallas = byId('pallas').orbit
    for (const point of sampleOrbit(pallas, 90)) {
      expect(Math.asin(point.z / point.distanceAu)).toBeLessThanOrEqual((34.93 * Math.PI) / 180 + 1e-9)
    }
  })
})

describe('motionDirection', () => {
  it('is perpendicular to the Sun direction at perihelion, and Halley orbits backward (retrograde)', () => {
    const halley = byId('halley').orbit
    const at = daysSinceJ2000('1986-02-09T11:00Z')
    const position = heliocentricPosition(halley, at)
    const motion = motionDirection(halley, at)
    expect(position.x * motion[0] + position.y * motion[1] + position.z * motion[2]).toBeCloseTo(0, 3)
    // Angular momentum r x v points south of the ecliptic for an inclination above 90 degrees.
    expect(position.x * motion[1] - position.y * motion[0]).toBeLessThan(0)
  })
})

describe('the small-body catalog', () => {
  it('has unique ids and bound (elliptical) orbits', () => {
    expect(new Set(SMALL_BODIES.map((body) => body.id)).size).toBe(SMALL_BODIES.length)
    for (const body of SMALL_BODIES) expect(body.orbit.eccentricity, body.id).toBeLessThan(1)
    expect(COMETS.length).toBeGreaterThan(4)
    expect(MINOR_PLANETS.map((body) => body.id)).toContain('ceres')
  })
})
