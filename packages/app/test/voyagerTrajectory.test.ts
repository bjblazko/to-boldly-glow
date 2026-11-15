import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Trajectory } from '../src/spacecraft/trajectory'
import { setSpacecraftTrajectory, spacecraftInFlight } from '../src/spacecraft/spacecraftCatalog'
import { ALL_ENTITIES, entityWorldPosition, planetAuPosition } from '../src/solarSystem/entities'
import { AU_TO_SCENE_UNITS } from '../src/solarSystem/sceneScale'
import { PLANETS } from '../src/solarSystem/bodies'
import { ephemerisAt } from '../src/time/ephemeris'

function trajectory(id: string): Trajectory {
  const bytes = readFileSync(join(__dirname, '..', 'public', 'data', 'voyager', `${id}.trajectory.bin`))
  return new Trajectory(new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4))
}

function daysSinceJ2000(iso: string): number {
  return ephemerisAt(new Date(iso)).daysSinceEpoch
}

// Closest approaches (NASA/JPL): Voyager 1 at Jupiter 1979-03-05 and Saturn 1980-11-12; Voyager 2
// at Jupiter 1979-07-09, Saturn 1981-08-26, Uranus 1986-01-24, Neptune 1989-08-25.
const FLYBYS = [
  { probe: 'voyager1', planet: 'jupiter', date: '1979-03-05T12:05Z' },
  { probe: 'voyager1', planet: 'saturn', date: '1980-11-12T23:46Z' },
  { probe: 'voyager2', planet: 'jupiter', date: '1979-07-09T22:29Z' },
  { probe: 'voyager2', planet: 'saturn', date: '1981-08-26T03:24Z' },
  { probe: 'voyager2', planet: 'uranus', date: '1986-01-24T17:59Z' },
  { probe: 'voyager2', planet: 'neptune', date: '1989-08-25T03:56Z' },
]

describe('the Voyager trajectories', () => {
  it.each(FLYBYS)('put $probe at $planet on its closest approach, in the frame of the app’s planets', ({ probe, planet, date }) => {
    const probePosition = trajectory(probe).positionAt(daysSinceJ2000(date))
    const definition = PLANETS.find((body) => body.id === planet)!
    const planetPosition = planetAuPosition(definition, ephemerisAt(new Date(date)).julianMillennia)
    const apartAu = Math.hypot(probePosition.x - planetPosition.x, probePosition.y - planetPosition.y, probePosition.z - planetPosition.z)
    // The thinned path and the truncated planet theory each allow ~0.001 AU; the flybys were closer.
    expect(apartAu).toBeLessThan(0.01)
  })

  it('has Voyager 1 beyond 160 AU in 2025', () => {
    expect(trajectory('voyager1').positionAt(daysSinceJ2000('2025-06-01')).distanceAu).toBeGreaterThan(160)
  })

  it('draws the path up to a day, ending where the probe is', () => {
    const path = trajectory('voyager2')
    const day = daysSinceJ2000('1986-01-24')
    const points = path.pathUntil(day)
    expect(points.at(-1)).toEqual(path.positionAt(day))
  })

  it('puts a found spacecraft where its trajectory says, and waits at Earth before launch', () => {
    setSpacecraftTrajectory('voyager1', trajectory('voyager1'))
    const voyager1 = ALL_ENTITIES.find((entity) => entity.id === 'voyager1')!
    const day = daysSinceJ2000('2012-08-25')
    const [x, y, z] = entityWorldPosition(voyager1, 0, day, 0)
    expect(Math.hypot(x, y, z) / AU_TO_SCENE_UNITS).toBeCloseTo(121.6, 0)
    expect(spacecraftInFlight('voyager1', daysSinceJ2000('1970-01-01'))).toBe(false)
    expect(spacecraftInFlight('voyager1', day)).toBe(true)
  })
})
