import { sphericalToX, sphericalToY, sphericalToZ } from '@toboldlyglow/engine'
import { PLANETS, SUN, type BodyDefinition } from './bodies'
import { MOONS, type MoonDefinition } from './moons'
import { scaledPosition, type AuPosition } from './sceneScale'
import { AU_KM } from './bodies'
import { moonOrbitAngleForParent, moonOrbitReferencePoleDirection, moonOrbitTilt, moonRelativePosition, scaledMoonOrbitRadiusUnits } from './moonOrbit'
import { equatorialToEclipticPoleDirection } from './poleOrientation'

export type EntityKind = 'sun' | 'planet' | 'moon'

export interface SolarSystemEntity {
  id: string
  name: string
  kind: EntityKind
  definition: BodyDefinition | MoonDefinition
}

export const ALL_ENTITIES: SolarSystemEntity[] = [
  { id: SUN.id, name: SUN.name, kind: 'sun', definition: SUN },
  ...PLANETS.map((p): SolarSystemEntity => ({ id: p.id, name: p.name, kind: 'planet', definition: p })),
  ...MOONS.map((m): SolarSystemEntity => ({ id: m.id, name: m.name, kind: 'moon', definition: m })),
]

export function matchesSearchQuery(entityName: string, query: string): boolean {
  return entityName.toLowerCase().includes(query.trim().toLowerCase())
}

export function searchEntities(query: string): SolarSystemEntity[] {
  if (!query.trim()) return []
  return ALL_ENTITIES.filter((e) => matchesSearchQuery(e.name, query))
}

// Returns a planet's true AU-space position (unscaled) and its true distance from the Sun.
export function planetAuPosition(planet: BodyDefinition, T: number): AuPosition {
  const position = planet.position
  if (!position) throw new Error(`${planet.id} has no position data.`)
  const longitude = position.longitude(T)
  const latitude = position.latitude(T)
  const distanceAu = position.distance(T)
  return {
    x: sphericalToX(longitude, latitude, distanceAu),
    y: sphericalToY(longitude, latitude, distanceAu),
    z: sphericalToZ(longitude, latitude, distanceAu),
    distanceAu,
  }
}

// Computes an entity's current world-space position (scene units), independent of the main
// frame's scene layout (scene/exploreLayout.ts). Used by camera-follow, which needs a single entity's
// position before those loops run in a given frame.
export function entityWorldPosition(
  entity: SolarSystemEntity,
  T: number,
  daysSinceEpoch: number,
  scaleBlend: number,
): [number, number, number] {
  if (entity.kind === 'sun') return [0, 0, 0]

  if (entity.kind === 'planet') {
    return scaledPosition(planetAuPosition(entity.definition as BodyDefinition, T), scaleBlend)
  }

  const moon = entity.definition as MoonDefinition
  const parent = ALL_ENTITIES.find((e) => e.id === moon.parentId)
  if (!parent) throw new Error(`${moon.id} has no known parent ${moon.parentId}.`)
  const [px, py, pz] = entityWorldPosition(parent, T, daysSinceEpoch, scaleBlend)
  const angle = moonOrbitAngleForParent(daysSinceEpoch, moon, parent.definition as BodyDefinition)
  const orbitRadius = scaledMoonOrbitRadiusUnits(moon.orbitDistanceKm, moon.compactOrbitVisualRadius, scaleBlend, AU_KM)
  const [rx, ry, rz] = moonRelativePosition(orbitRadius, angle, moonOrbitTilt(moon, parent.definition as BodyDefinition))
  return [px + rx, py + ry, pz + rz]
}

// An entity's own real north-pole direction - the same value already used to tilt its rendered
// mesh (see scene/exploreLayout.ts's use of equatorialToEclipticPoleDirection for the Sun/planets and
// moonOrbitReferencePoleDirection for moons). Used by CameraFollowController to orient the camera
// to a followed entity's real "up" instead of the scene's generic ecliptic north.
export function entityPoleDirection(entity: SolarSystemEntity): [number, number, number] {
  if (entity.kind === 'moon') {
    const moon = entity.definition as MoonDefinition
    const parent = ALL_ENTITIES.find((e) => e.id === moon.parentId)
    if (!parent) throw new Error(`${moon.id} has no known parent ${moon.parentId}.`)
    return moonOrbitReferencePoleDirection(moon, parent.definition as BodyDefinition)
  }
  const body = entity.definition as BodyDefinition
  return equatorialToEclipticPoleDirection(body.poleRightAscensionDegrees, body.poleDeclinationDegrees)
}
