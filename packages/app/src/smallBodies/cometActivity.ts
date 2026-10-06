import type { Vec3 } from '../math/tuples'
import { scaledPosition, AU_TO_SCENE_UNITS, COMPACT_DISTANCE_SCALE } from '../solarSystem/sceneScale'
import { heliocentricPosition, motionDirection } from './keplerOrbit'
import type { SmallBodyDefinition } from './smallBodyCatalog'

// Water ice sublimates in earnest inside about 3 AU from the Sun: half of a comet's full activity
// at this distance, rising steeply closer in (more volatile ices keep big comets faintly active
// farther out).
const HALF_ACTIVITY_AU = 2.4
// A large nucleus outgasses more: Hale-Bopp's 30 km nucleus grew tails tens of millions of km long.
const REFERENCE_NUCLEUS_KM = 5
// Tail and coma sizes at full activity for a reference comet, in AU.
const ION_TAIL_AU = 0.32
const DUST_TAIL_AU = 0.2
const COMA_AU = 0.0035

// What a comet looks like right now, in scene units.
export interface CometState {
  comet: SmallBodyDefinition
  position: Vec3
  distanceAu: number
  // 0 (a dormant nucleus, far out) to about 1 (near perihelion), times its size.
  activity: number
  // Unit vectors: the ion tail points straight away from the Sun; the dust tail curves back from
  // it toward where the comet came from.
  antiSunward: Vec3
  behind: Vec3
  ionTailLength: number
  dustTailLength: number
  comaRadius: number
}

export function cometActivity(distanceAu: number, nucleusKm: number): number {
  const vigor = Math.min(Math.max((nucleusKm / REFERENCE_NUCLEUS_KM) ** 0.6, 0.5), 3)
  return vigor / (1 + (distanceAu / HALF_ACTIVITY_AU) ** 4)
}

// Scene units per AU at this distance from the Sun: the slope of the Realistic/Compact distance
// blend, so tails keep the right size wherever the comet is.
export function sceneUnitsPerAu(distanceAu: number, scaleBlend: number): number {
  const compactSlope = COMPACT_DISTANCE_SCALE / (1 + distanceAu)
  return AU_TO_SCENE_UNITS + (compactSlope - AU_TO_SCENE_UNITS) * scaleBlend
}

export function cometState(comet: SmallBodyDefinition, daysSinceEpoch: number, scaleBlend: number): CometState {
  const au = heliocentricPosition(comet.orbit, daysSinceEpoch)
  const position = scaledPosition(au, scaleBlend)
  const antiSunward: Vec3 = [au.x / au.distanceAu, au.y / au.distanceAu, au.z / au.distanceAu]
  const motion = motionDirection(comet.orbit, daysSinceEpoch)
  const activity = cometActivity(au.distanceAu, comet.radiusKm)
  const scale = sceneUnitsPerAu(au.distanceAu, scaleBlend)
  // The solar wind blows the ions out at hundreds of km/s; the dust drifts out slowly enough to
  // lag behind the comet's motion along its orbit.
  const tailScale = scale * activity / Math.sqrt(Math.max(au.distanceAu, 0.3))
  return {
    comet,
    position,
    distanceAu: au.distanceAu,
    activity,
    antiSunward,
    behind: [-motion[0], -motion[1], -motion[2]],
    ionTailLength: ION_TAIL_AU * tailScale,
    dustTailLength: DUST_TAIL_AU * tailScale,
    comaRadius: COMA_AU * scale * Math.sqrt(activity),
  }
}
