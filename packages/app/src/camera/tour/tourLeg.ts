import { vec3 } from 'gl-matrix'
import { AU_KM, type BodyDefinition } from '../../solarSystem/bodies'
import { entityWorldPosition, type SolarSystemEntity } from '../../solarSystem/entities'
import { scaledBodyRadiusUnits } from '../../solarSystem/sceneScale'
import type { Ephemeris } from '../../time/ephemeris'
import { WORLD_UP } from './shipView'

// A leg takes about TRANSIT_SECONDS (longer if its pace asks for it), flown in powers of ten: the
// ship's speed grows with its distance from the stop it left and shrinks with its distance to the
// next, at the leg's log rate - each doubling or halving of a distance takes the same time, at any
// scale. So the planet left behind shrinks steadily instead of vanishing, the long middle of a
// Realistic leg passes at warp speed, and the ship slows into the next loop just as gradually. The
// rate is planned from the doublings there are to fly, within MIN_LOG_RATE and MAX_LOG_RATE (above
// it the lagging speed would overshoot the loop); pulling away, past the first moments, it is WARP
// times that. The engine reaches cruise speed - the peak - or brakes from it in at most
// ACCELERATION_SECONDS, and always keeps up with the rates.
const TRANSIT_SECONDS = 20
const MIN_LOG_RATE = 0.05
const MAX_LOG_RATE = 0.6
const LOG_RATE_HEADROOM = 1.5
// Once clear of the stop it left, the ship pulls away this many times faster still: the warp.
export const WARP = 3
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

const NO_PACE: LegPace = { transitSeconds: 0, lapSeconds: 0 }

// One leg of the tour: the flight to a planet and the loop around it.
export interface Leg {
  target: SolarSystemEntity
  // The stop the ship circled before, and pulls away from - null on the first leg, or when the
  // ship gave up on reaching its last target.
  from: SolarSystemEntity | null
  // The loop is entered at the planet's side (seen along the leg), so the ship arrives tangentially.
  side: vec3
  loopRadius: number
  cruiseSpeed: number
  // How fast distances grow and shrink (per second, as a natural log): see TRANSIT_SECONDS.
  logRate: number
  // The speed the ship set off with.
  startSpeed: number
  // The engine's thrust, in units per second squared (see engineAcceleration).
  acceleration: number
  // The thrust it turns with: enough to cover the leg at an even pace in its transit time, reached
  // in ACCELERATION_SECONDS - so the warp flies straight instead of carving tighter curves.
  turnAcceleration: number
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
// faster than this leg's cruise speed); `from` is the stop it is leaving.
export function planLeg(
  target: SolarSystemEntity,
  start: vec3,
  moment: { ephemeris: Ephemeris; scaleBlend: number },
  { pace = NO_PACE, startSpeed = 0, from = null }: { pace?: LegPace; startSpeed?: number; from?: SolarSystemEntity | null } = {},
): Leg {
  const toTarget = vec3.subtract(vec3.create(), planetPosition(target, moment.ephemeris, moment.scaleBlend), start)
  const distance = vec3.length(toTarget)
  const loopRadius = loopRadiusAt(target, moment.scaleBlend)
  const transitSeconds = Math.max(TRANSIT_SECONDS, pace.transitSeconds)
  const logRate = plannedLogRate(distance, { loopRadius, fromRadius: from && loopRadiusAt(from, moment.scaleBlend), transitSeconds })
  const cruiseSpeed = Math.max(logRate * distance, MIN_CRUISE_SPEED)
  return {
    target,
    from,
    side: approachSide(toTarget),
    loopRadius,
    cruiseSpeed,
    logRate,
    startSpeed,
    acceleration: Math.max(cruiseSpeed, startSpeed) * Math.max(1 / ACCELERATION_SECONDS, LOG_RATE_HEADROOM * WARP * logRate),
    turnAcceleration: Math.max(distance / transitSeconds, startSpeed, MIN_CRUISE_SPEED) / ACCELERATION_SECONDS,
    loopAngularSpeed: (2 * Math.PI) / Math.max(LOOP_SECONDS, pace.lapSeconds),
  }
}

// The log rate that covers the leg's doublings - out from the stop it left (at the warped rate, if
// it left one) and in to the next - in its transit time.
function plannedLogRate(distance: number, { loopRadius, fromRadius, transitSeconds }: { loopRadius: number; fromRadius: number | null; transitSeconds: number }): number {
  const doublings = logSpan(distance, loopRadius) + (fromRadius === null ? 1 : logSpan(distance, fromRadius) / WARP)
  return Math.min(Math.max(doublings / transitSeconds, MIN_LOG_RATE), MAX_LOG_RATE)
}

// How far a distance is from a radius, in natural-log steps.
function logSpan(distance: number, radius: number): number {
  return Math.log(Math.max(distance / Math.max(radius, 1e-12), 1))
}

// The planet's side seen along the leg, where the loop is entered.
function approachSide(toTarget: vec3): vec3 {
  const direction = vec3.length(toTarget) > 1e-6 ? vec3.normalize(vec3.create(), toTarget) : vec3.fromValues(0, 0, 1)
  let side = vec3.cross(vec3.create(), direction, WORLD_UP)
  if (vec3.length(side) < 1e-6) side = vec3.cross(vec3.create(), direction, [1, 0, 0])
  return vec3.normalize(side, side)
}

// The engine's thrust, scaled to the leg: it reaches the leg's cruise speed - or brakes from the
// speed it set off with, if that was faster - in ACCELERATION_SECONDS or sooner.
export function engineAcceleration(leg: Leg): number {
  return leg.acceleration
}
