import { describe, expect, it } from 'vitest'
import { shellRadiusFactor } from '../src/atmosphereShell/atmosphereShell'
import { PLANETS } from '../src/solarSystem/bodies'

const planet = (id: string) => PLANETS.find((candidate) => candidate.id === id)!

describe('the atmosphere shells, to scale', () => {
  it("reach Earth's air to the Kármán line, 100 km over 6,371", () => {
    expect(shellRadiusFactor(planet('earth'))).toBeCloseTo(1 + 100 / 6371, 6)
  })

  it('stay within about one percent of the radius on every planet that has one', () => {
    for (const id of ['venus', 'earth', 'jupiter', 'saturn', 'uranus', 'neptune']) {
      expect(shellRadiusFactor(planet(id))).toBeGreaterThan(1.002)
      expect(shellRadiusFactor(planet(id))).toBeLessThan(1.02)
    }
  })
})
