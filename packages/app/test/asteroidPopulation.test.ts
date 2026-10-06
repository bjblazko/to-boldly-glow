import { describe, expect, it } from 'vitest'
import { asteroidInstances } from '../src/smallBodies/asteroidBelt'
import { asteroidPopulation, FLOATS_PER_ASTEROID, inKirkwoodGap, POPULATION_COUNTS } from '../src/smallBodies/asteroidPopulation'
import { MINOR_PLANETS } from '../src/smallBodies/smallBodyCatalog'

const population = asteroidPopulation()
const orbits = Array.from({ length: population.length / FLOATS_PER_ASTEROID }, (_, i) => population.subarray(i * FLOATS_PER_ASTEROID, (i + 1) * FLOATS_PER_ASTEROID))
const total = Object.values(POPULATION_COUNTS).reduce((sum, count) => sum + count, 0)
const meanLongitudeDegrees = ([, , , node, perihelion, mean]: Float32Array) => ((((node + perihelion + mean) * 180) / Math.PI) % 360 + 360) % 360

describe('asteroidPopulation', () => {
  it('generates every population, the same way every time', () => {
    expect(orbits).toHaveLength(total)
    expect(asteroidPopulation()).toEqual(population)
  })

  it('leaves the Kirkwood gaps of the main belt empty', () => {
    const mainBelt = orbits.slice(0, POPULATION_COUNTS.mainBelt)
    expect(mainBelt.filter(([a]) => inKirkwoodGap(a))).toHaveLength(0)
    expect(mainBelt.every(([a]) => a >= 2.1 && a <= 3.3)).toBe(true)
  })

  it('puts the Trojans 60° ahead of and behind Jupiter (mean longitude 34.4° at J2000)', () => {
    const trojans = orbits.slice(POPULATION_COUNTS.mainBelt + POPULATION_COUNTS.hildas, POPULATION_COUNTS.mainBelt + POPULATION_COUNTS.hildas + POPULATION_COUNTS.trojans)
    const fromJupiter = trojans.map((orbit) => ((meanLongitudeDegrees(orbit) - 34.4 + 540) % 360) - 180)
    const nearL4 = fromJupiter.filter((angle) => Math.abs(angle - 60) < 40).length
    const nearL5 = fromJupiter.filter((angle) => Math.abs(angle + 60) < 40).length
    expect(nearL4 + nearL5).toBeGreaterThan(trojans.length * 0.95)
    expect(nearL4).toBeGreaterThan(nearL5)
  })

  it('keeps every orbit bound and within the far reaches of the Kuiper belt', () => {
    for (const [a, e] of orbits) {
      expect(e).toBeLessThan(0.7)
      expect(a * (1 + e)).toBeLessThan(200)
    }
  })
})

describe('asteroidInstances', () => {
  it('appends the named minor planets to the generated populations', () => {
    expect(asteroidInstances().length).toBe(population.length + MINOR_PLANETS.length * FLOATS_PER_ASTEROID)
  })
})
