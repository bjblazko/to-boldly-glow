import { vec3 } from 'gl-matrix'
import { AU_KM, type BodyDefinition } from '../../solarSystem/bodies'
import { entityWorldPosition, type SolarSystemEntity } from '../../solarSystem/entities'
import { scaledBodyRadiusUnits } from '../../solarSystem/sceneScale'
import type { Ephemeris } from '../../time/ephemeris'
import { WORLD_UP } from './shipView'

// A leg's cruise speed is its length over this many seconds (at least MIN_CRUISE_SPEED), and the
// engine reaches cruise speed - or brakes from it - in ACCELERATION_SECONDS.
const TRANSIT_SECONDS = 20
export const MIN_CRUISE_SPEED = 0.5
export const ACCELERATION_SECONDS = 5

// The flyby loop circles the planet at this many body radii, so the planet looks the same size at
// any scale.
const LOOP_RADIUS_IN_BODY_RADII = 8

// One leg of the tour: the flight to a planet and the loop around it.
export interface Leg {
  target: SolarSystemEntity
  // The loop is entered at the planet's side (seen along the leg), so the ship arrives tangentially.
  side: vec3
  loopRadius: number
  cruiseSpeed: number
}

export function planetPosition(target: SolarSystemEntity, ephemeris: Ephemeris, scaleBlend: number): vec3 {
  return vec3.fromValues(...entityWorldPosition(target, ephemeris.julianMillennia, ephemeris.daysSinceEpoch, scaleBlend))
}

export function loopRadiusAt(target: SolarSystemEntity, scaleBlend: number): number {
  const { radiusKm, compactVisualRadius } = target.definition as BodyDefinition
  return scaledBodyRadiusUnits(radiusKm, compactVisualRadius, scaleBlend, AU_KM) * LOOP_RADIUS_IN_BODY_RADII
}

export function planLeg(target: SolarSystemEntity, from: vec3, moment: { ephemeris: Ephemeris; scaleBlend: number }): Leg {
  const toTarget = vec3.subtract(vec3.create(), planetPosition(target, moment.ephemeris, moment.scaleBlend), from)
  const direction = vec3.length(toTarget) > 1e-6 ? vec3.normalize(vec3.create(), toTarget) : vec3.fromValues(0, 0, 1)
  let side = vec3.cross(vec3.create(), direction, WORLD_UP)
  if (vec3.length(side) < 1e-6) side = vec3.cross(vec3.create(), direction, [1, 0, 0])
  return {
    target,
    side: vec3.normalize(side, side),
    loopRadius: loopRadiusAt(target, moment.scaleBlend),
    cruiseSpeed: Math.max(vec3.length(toTarget) / TRANSIT_SECONDS, MIN_CRUISE_SPEED),
  }
}

// The engine's thrust, scaled to the leg: it reaches the leg's cruise speed in ACCELERATION_SECONDS.
export function engineAcceleration(leg: Leg): number {
  return leg.cruiseSpeed / ACCELERATION_SECONDS
}
