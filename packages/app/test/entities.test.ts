import { describe, expect, it } from 'vitest'
import {
  ALL_ENTITIES,
  entityPoleDirection,
  entityWorldPosition,
  matchesSearchQuery,
  planetAuPosition,
  searchEntities,
  type SolarSystemEntity,
} from '../src/solarSystem/entities'
import { AU_KM, PLANETS } from '../src/solarSystem/bodies'
import { MOONS } from '../src/solarSystem/moons'
import { scaledPosition } from '../src/solarSystem/sceneScale'
import { moonOrbitAngleRadians, moonOrbitReferencePoleDirection, moonRelativePosition, scaledMoonOrbitRadiusUnits } from '../src/solarSystem/moonOrbit'
import { equatorialToEclipticPoleDirection } from '../src/solarSystem/poleOrientation'

function findEntity(id: string): SolarSystemEntity {
  const entity = ALL_ENTITIES.find((e) => e.id === id)
  if (!entity) throw new Error(`no entity ${id}`)
  return entity
}

describe('ALL_ENTITIES', () => {
  it('contains the Sun, all 8 planets, and all 9 moons, and nothing else', () => {
    expect(ALL_ENTITIES).toHaveLength(1 + PLANETS.length + MOONS.length)
    expect(ALL_ENTITIES.filter((e) => e.kind === 'sun')).toHaveLength(1)
    expect(ALL_ENTITIES.filter((e) => e.kind === 'planet')).toHaveLength(8)
    expect(ALL_ENTITIES.filter((e) => e.kind === 'moon')).toHaveLength(9)
  })
})

describe('matchesSearchQuery', () => {
  it('matches case-insensitively', () => {
    expect(matchesSearchQuery('Titan', 'titan')).toBe(true)
    expect(matchesSearchQuery('Titan', 'TITAN')).toBe(true)
  })

  it('matches as a substring, not just a prefix', () => {
    expect(matchesSearchQuery('Titan', 'tan')).toBe(true)
  })

  it('does not match unrelated text', () => {
    expect(matchesSearchQuery('Titan', 'europa')).toBe(false)
  })
})

describe('searchEntities', () => {
  it('returns no results for an empty query', () => {
    expect(searchEntities('')).toEqual([])
    expect(searchEntities('   ')).toEqual([])
  })

  it('matches entities across kinds for a shared substring', () => {
    const results = searchEntities('a').map((e) => e.id)
    expect(results).toContain('mars')
    expect(results).toContain('saturn')
    expect(results).toContain('callisto')
  })

  it('substring-matches, including a longer name that contains the query', () => {
    const results = searchEntities('Titan')
    expect(results.map((e) => e.id).sort()).toEqual(['titan', 'titania'])
  })
})

describe('entityWorldPosition', () => {
  const T = 0.5
  const daysSinceEpoch = 1000
  const scaleBlend = 0.3

  it("returns the origin for the Sun, regardless of time", () => {
    const sun = findEntity('sun')
    expect(entityWorldPosition(sun, T, daysSinceEpoch, scaleBlend)).toEqual([0, 0, 0])
    expect(entityWorldPosition(sun, 99, 12345, 1)).toEqual([0, 0, 0])
  })

  it('matches the render loop math for a planet', () => {
    const mars = findEntity('mars')
    const { x, y, z, distanceAu } = planetAuPosition(mars.definition as (typeof PLANETS)[number], T)
    const expected = scaledPosition(x, y, z, distanceAu, scaleBlend)
    const actual = entityWorldPosition(mars, T, daysSinceEpoch, scaleBlend)
    expect(actual[0]).toBeCloseTo(expected[0], 10)
    expect(actual[1]).toBeCloseTo(expected[1], 10)
    expect(actual[2]).toBeCloseTo(expected[2], 10)
  })

  it("matches parent position plus orbital offset for a moon", () => {
    const titan = findEntity('titan')
    const saturn = findEntity('saturn')
    const [px, py, pz] = entityWorldPosition(saturn, T, daysSinceEpoch, scaleBlend)
    const moon = titan.definition as (typeof MOONS)[number]
    const angle = moonOrbitAngleRadians(daysSinceEpoch, moon.siderealOrbitPeriodDays)
    const orbitRadius = scaledMoonOrbitRadiusUnits(moon.orbitDistanceKm, moon.explorerOrbitVisualRadius, scaleBlend, AU_KM)
    const referencePoleDirection = moonOrbitReferencePoleDirection(moon, saturn.definition as (typeof PLANETS)[number])
    const [rx, ry, rz] = moonRelativePosition(
      orbitRadius,
      angle,
      moon.orbitInclinationToParentEquatorDegrees,
      moon.orbitAscendingNodeDegrees,
      referencePoleDirection,
    )
    const actual = entityWorldPosition(titan, T, daysSinceEpoch, scaleBlend)
    expect(actual[0]).toBeCloseTo(px + rx, 10)
    expect(actual[1]).toBeCloseTo(py + ry, 10)
    expect(actual[2]).toBeCloseTo(pz + rz, 10)
  })
})

describe('entityPoleDirection', () => {
  it('matches equatorialToEclipticPoleDirection for a planet', () => {
    const mars = findEntity('mars')
    const body = mars.definition as (typeof PLANETS)[number]
    const expected = equatorialToEclipticPoleDirection(body.poleRightAscensionDegrees, body.poleDeclinationDegrees)
    expect(entityPoleDirection(mars)).toEqual(expected)
  })

  it('matches equatorialToEclipticPoleDirection for the Sun', () => {
    const sun = findEntity('sun')
    const body = sun.definition as (typeof PLANETS)[number]
    const expected = equatorialToEclipticPoleDirection(body.poleRightAscensionDegrees, body.poleDeclinationDegrees)
    expect(entityPoleDirection(sun)).toEqual(expected)
  })

  it('matches moonOrbitReferencePoleDirection for a moon', () => {
    const titan = findEntity('titan')
    const saturn = findEntity('saturn')
    const moon = titan.definition as (typeof MOONS)[number]
    const expected = moonOrbitReferencePoleDirection(moon, saturn.definition as (typeof PLANETS)[number])
    expect(entityPoleDirection(titan)).toEqual(expected)
  })
})
