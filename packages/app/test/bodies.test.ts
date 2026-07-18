import { describe, expect, it } from 'vitest'
import { AU_KM, PLANETS, SUN } from '../src/solarSystem/bodies'

describe('body registry', () => {
  it('lists exactly the 8 planets in orbital order', () => {
    expect(PLANETS.map((p) => p.id)).toEqual([
      'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune',
    ])
  })

  it('every planet has a position lookup and the Sun does not', () => {
    for (const planet of PLANETS) expect(planet.position).not.toBeNull()
    expect(SUN.position).toBeNull()
    expect(SUN.siderealPeriodDays).toBeNull()
  })

  it('radii follow known solar-system size ordering (sanity check against NASA fact sheet)', () => {
    const byId = Object.fromEntries(PLANETS.map((p) => [p.id, p.radiusKm]))
    expect(SUN.radiusKm).toBeGreaterThan(byId.jupiter)
    expect(byId.jupiter).toBeGreaterThan(byId.saturn)
    expect(byId.saturn).toBeGreaterThan(byId.uranus)
    expect(byId.uranus).toBeGreaterThan(byId.neptune) // Uranus and Neptune are close in size
    expect(byId.earth).toBeGreaterThan(byId.mars)
    expect(byId.venus).toBeGreaterThan(byId.mercury)
  })

  it("sidereal periods roughly satisfy Kepler's third law given known semi-major axes", () => {
    // T(years) ≈ a(AU)^1.5 — cross-checks the hand-entered period constants independently of
    // their source, catching a transcription error even without redoing the NASA lookup.
    const semiMajorAxisAu: Record<string, number> = {
      mercury: 0.387, venus: 0.723, earth: 1.0, mars: 1.524,
      jupiter: 5.203, saturn: 9.537, uranus: 19.191, neptune: 30.069,
    }
    for (const planet of PLANETS) {
      const expectedDays = Math.pow(semiMajorAxisAu[planet.id], 1.5) * 365.25
      const actualDays = planet.siderealPeriodDays as number
      expect(Math.abs(actualDays - expectedDays) / expectedDays).toBeLessThan(0.03)
    }
  })

  it('AU_KM matches the standard astronomical unit definition', () => {
    expect(AU_KM).toBeCloseTo(149_597_870.7, 1)
  })
})
