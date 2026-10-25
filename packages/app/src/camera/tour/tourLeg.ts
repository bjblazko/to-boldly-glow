import { vec3 } from 'gl-matrix'
import { AU_KM, type BodyDefinition } from '../../solarSystem/bodies'
import { entityWorldPosition, type SolarSystemEntity } from '../../solarSystem/entities'
import { scaledBodyRadiusUnits } from '../../solarSystem/sceneScale'
import type { Ephemeris } from '../../time/ephemeris'
import { WORLD_UP } from './shipView'

// A leg's cruise speed is its length over this many seconds (at least MIN_CRUISE_SPEED; longer if
// the leg's pace asks for it), and the engine reaches cruise speed - or brakes from it - in
// ACCELERATION_SECONDS.
const TRANSIT_SECONDS = 20
export const MIN_CRUISE_SPEED = 0.5
export const ACCELERATION_SECONDS = 5

// The flyby loop circles the planet at this many body radii, so the planet looks the same size at
// any scale, and takes about LOOP_SECONDS per lap (longer if the leg's pace asks for it).
const LOOP_RADIUS_IN_BODY_RADII = 8
const LOOP_SECONDS = 14

// How long a leg should at least take: the flight there and one lap around (the narrated tour sets
// them to its narration's length).
export interface LegPace {
  transitSeconds: number
  lapSeconds: number
}

// One leg of the tour: the flight to a planet and the loop around it.
export interface Leg {
  target: SolarSystemEntity
  // The loop is entered at the planet's side (seen along the leg), so the ship arrives tangentially.
  side: vec3
  loopRadius: number
  cruiseSpeed: number
  // The engine's thrust, in units per second squared (see engineAcceleration).
  acceleration: number
  // Radians per second around the planet.
  loopAngularSpeed: number
}

export function planetPosition(target: SolarSystemEntity, ephemeris: Ephemeris, scaleBlend: number): vec3 {
  return vec3.fromValues(...entityWorldPosition(target, ephemeris.julianMillennia, ephemeris.daysSinceEpoch, scaleBlend))
}

export function loopRadiusAt(target: SolarSystemEntity, scaleBlend: number): number {
  const { radiusKm, compactVisualRadius } = target.definition as BodyDefinition
  return scaledBodyRadiusUnits(radiusKm, compactVisualRadius, scaleBlend, AU_KM) * LOOP_RADIUS_IN_BODY_RADII
}

// startSpeed is how fast the ship is already going (leaving a large loop, like the Sun's, it may be
// faster than this leg's cruise speed).
export function planLeg(target: SolarSystemEntity, from: vec3, moment: { ephemeris: Ephemeris; scaleBlend: number }, { pace, startSpeed = 0 }: { pace?: LegPace; startSpeed?: number } = {}): Leg {
  const toTarget = vec3.subtract(vec3.create(), planetPosition(target, moment.ephemeris, moment.scaleBlend), from)
  const cruiseSpeed = Math.max(vec3.length(toTarget) / Math.max(TRANSIT_SECONDS, pace?.transitSeconds ?? 0), MIN_CRUISE_SPEED)
  return {
    target,
    side: approachSide(toTarget),
    loopRadius: loopRadiusAt(target, moment.scaleBlend),
    cruiseSpeed,
    acceleration: Math.max(cruiseSpeed, startSpeed) / ACCELERATION_SECONDS,
    loopAngularSpeed: (2 * Math.PI) / Math.max(LOOP_SECONDS, pace?.lapSeconds ?? 0),
  }
}

// The planet's side seen along the leg, where the loop is entered.
function approachSide(toTarget: vec3): vec3 {
  const direction = vec3.length(toTarget) > 1e-6 ? vec3.normalize(vec3.create(), toTarget) : vec3.fromValues(0, 0, 1)
  let side = vec3.cross(vec3.create(), direction, WORLD_UP)
  if (vec3.length(side) < 1e-6) side = vec3.cross(vec3.create(), direction, [1, 0, 0])
  return vec3.normalize(side, side)
}

// The engine's thrust, scaled to the leg: it reaches the leg's cruise speed - or brakes from the
// speed it set off with, if that was faster - in ACCELERATION_SECONDS.
export function engineAcceleration(leg: Leg): number {
  return leg.acceleration
}
