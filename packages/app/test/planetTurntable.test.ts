import { describe, expect, it } from 'vitest'
import { findPlanet } from '../src/scene/sceneLayout'
import { sizesLayout } from '../src/learn/sizes/sizesLineup'
import { PlanetTurntable, TURNTABLE_SECONDS_PER_TURN } from '../src/learn/sizes/planetTurntable'
import { ephemerisAt } from '../src/time/ephemeris'

const ephemeris = ephemerisAt(new Date('2026-01-01T00:00:00Z'))
const spinOf = (turntable: PlanetTurntable, id: string) => findPlanet(sizesLayout(ephemeris, turntable), id)!.spinRadians
const QUARTER_TURN = TURNTABLE_SECONDS_PER_TURN / 4

describe('PlanetTurntable', () => {
  it('turns only the planet in focus, every planet equally fast, the way it really spins', () => {
    const turntable = new PlanetTurntable()
    const still = { jupiter: spinOf(turntable, 'jupiter'), mercury: spinOf(turntable, 'mercury'), venus: spinOf(turntable, 'venus') }

    turntable.update(QUARTER_TURN, 'jupiter')
    expect(spinOf(turntable, 'jupiter') - still.jupiter).toBeCloseTo(Math.PI / 2, 9)
    expect(spinOf(turntable, 'mercury')).toBe(still.mercury)

    // Mercury takes 59 days to spin once, Jupiter 10 hours - here both a quarter turn in the same time.
    turntable.update(QUARTER_TURN, 'mercury')
    expect(spinOf(turntable, 'mercury') - still.mercury).toBeCloseTo(Math.PI / 2, 9)
    expect(spinOf(turntable, 'jupiter') - still.jupiter).toBeCloseTo(Math.PI / 2, 9)

    // Venus spins backwards.
    turntable.update(QUARTER_TURN, 'venus')
    expect(spinOf(turntable, 'venus') - still.venus).toBeCloseTo(-Math.PI / 2, 9)
  })

  it('stands still on the lineup, where no planet is in focus', () => {
    const turntable = new PlanetTurntable()
    const before = sizesLayout(ephemeris, turntable).planets.map((planet) => planet.spinRadians)
    turntable.update(QUARTER_TURN, undefined)
    expect(sizesLayout(ephemeris, turntable).planets.map((planet) => planet.spinRadians)).toEqual(before)
  })
})
