import { beforeAll, describe, expect, it } from 'vitest'
import { inLunarOrbit, type LunarOrbitCheckpoints } from '../src/apollo/trajectory/apollo11LunarOrbit'
import { grailField } from '../src/apollo/trajectory/lunarGravity'

// Columbia's 30 lunar orbits, reconstructed with the Moon's gravity field, against ABTN's numbers
// (altitudes in n mi, speeds in ft/s, orbits apocynthion x pericynthion).
describe("Columbia's lunar orbits, with the Moon's gravity field", () => {
  let flown: LunarOrbitCheckpoints
  beforeAll(async () => {
    flown = inLunarOrbit(await grailField(60))
  }, 120_000)

  it('circularizes into the documented 66.1 by 54.5 n mi orbit', () => {
    expect(flown.circularized.apocynthion).toBeCloseTo(66.1, 1)
    expect(flown.circularized.pericynthion).toBeCloseTo(54.5, 1)
  })

  it('is where the record has it at undocking, docking and the ascent stage’s jettison, within 3.5 n mi', () => {
    expect(Math.abs(flown.undocked.altitude - 62.9)).toBeLessThan(3.5)
    expect(Math.abs(flown.docked.altitude - 60.6)).toBeLessThan(3.5)
    expect(Math.abs(flown.jettisoned.altitude - 61.6)).toBeLessThan(3.5)
  })

  it('has the documented orbit after the separation burn, within 2 n mi', () => {
    expect(Math.abs(flown.separated.apocynthion - 63.7)).toBeLessThan(2)
    expect(Math.abs(flown.separated.pericynthion - 56.0)).toBeLessThan(2)
  })

  it('arrives at the transearth injection at its documented height and speed', () => {
    expect(Math.abs(flown.atTei.altitude - 52.4)).toBeLessThan(1)
    expect(Math.abs(flown.atTei.speed - 5376.0)).toBeLessThan(15)
  })

  it('needs the field: a point-mass Moon misses the injection by more', async () => {
    const pointMass = inLunarOrbit(null)
    expect(Math.abs(pointMass.atTei.altitude - 52.4)).toBeGreaterThan(Math.abs(flown.atTei.altitude - 52.4) + 2)
  }, 120_000)

  it('has converged at degree 60: degree 40 changes the injection’s height by less than 0.3 n mi', async () => {
    const coarser = inLunarOrbit(await grailField(40))
    expect(Math.abs(coarser.atTei.altitude - flown.atTei.altitude)).toBeLessThan(0.3)
  }, 120_000)
})

