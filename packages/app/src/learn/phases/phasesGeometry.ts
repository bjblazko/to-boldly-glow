import { vec3 } from 'gl-matrix'
import { degreesToRadians, type Vec3 } from '../../math/tuples'
import { ECLIPTIC_NORTH } from '../../solarSystem/poleOrientation'
import { MOON_ORBIT_RADIUS, MOON_RADIUS, perpendicularUnit, stagedMoonPosition } from '../eclipse/eclipseGeometry'
import type { GroundShot } from '../ground/groundShot'

// The Moon phases lesson stages the same Earth and Moon as the solar eclipse lesson (see
// eclipse/eclipseGeometry.ts), on the Sun's +X side - but ten times farther from the Sun. The Moon's
// shape depends on the angle between the sunlight and our view of it; with the Sun as close as in
// the eclipse lesson, sunlight would strike the Moon at a noticeably different angle than it
// strikes Earth, and the Moon would look 60% lit at first quarter. From this far it is half lit,
// as from the real Sun, nearly 400 times farther away than the Moon.
// The orbit lies flat in the plane of Earth's orbit, except where the lesson shows the full Moon
// passing Earth's shadow: there it is tilted, as steeply as in the eclipse lesson. Measured from
// the Sun's direction, the tilt's crossing points lie square to it, so the Moon passes above the Sun
// at new moon and below Earth's shadow at full moon.
export const PHASES_EARTH_POSITION: Vec3 = [400, 0, 0]
export const PHASES_NODE_DEGREES = 90
export const FLAT_ORBIT = 0

export function phasesMoonPosition(ageDegrees: number, tiltDegrees = FLAT_ORBIT): Vec3 {
  return stagedMoonPosition(PHASES_NODE_DEGREES, ageDegrees, tiltDegrees, PHASES_EARTH_POSITION)
}

// The angle at the Moon between the Sun and Earth (radians): 0 at full moon, PI at new moon.
export function phaseAngle(moon: ArrayLike<number>, earth: ArrayLike<number> = PHASES_EARTH_POSITION): number {
  const toSun = vec3.normalize(vec3.create(), [-moon[0], -moon[1], -moon[2]])
  const toEarth = vec3.normalize(vec3.create(), [earth[0] - moon[0], earth[1] - moon[1], earth[2] - moon[2]])
  return Math.acos(Math.min(1, Math.max(-1, vec3.dot(toSun, toEarth))))
}

// The share of the Moon's disc that is lit, as seen from Earth.
export function litFraction(phaseAngleRadians: number): number {
  return (1 + Math.cos(phaseAngleRadians)) / 2
}

// Earthshine on the Moon's night side follows how much of Earth's day side faces the Moon: nearly
// all of it at new moon, none at full moon.
const EARTHSHINE_AT_NEW_MOON = 0.035

export function earthshineStrength(phaseAngleRadians: number): number {
  return (EARTHSHINE_AT_NEW_MOON * (1 - Math.cos(phaseAngleRadians))) / 2
}

export function waxing(ageDegrees: number): boolean {
  return wrapDegrees(ageDegrees) < 180
}

export function wrapDegrees(degrees: number): number {
  return ((degrees % 360) + 360) % 360
}

const PHASE_NAMES: [upTo: number, name: string][] = [
  [8, 'New moon'],
  [82, 'Waxing crescent'],
  [98, 'First quarter'],
  [172, 'Waxing gibbous'],
  [188, 'Full moon'],
  [262, 'Waning gibbous'],
  [278, 'Last quarter'],
  [352, 'Waning crescent'],
  [360, 'New moon'],
]

export function phaseName(ageDegrees: number): string {
  const age = wrapDegrees(ageDegrees)
  return PHASE_NAMES.find(([upTo]) => age < upTo)?.[1] ?? 'New moon'
}

// The Moon seen from Earth's center (where the ground chapters' camera stands): its angular radius.
export const MOON_ANGULAR_RADIUS_DEGREES = (Math.asin(MOON_RADIUS / MOON_ORBIT_RADIUS) * 180) / Math.PI

// The sky over an observer who sees the Moon `moonAltitude` degrees above the horizon and the Sun
// `sunAltitude` degrees above it (below, if negative): straight up for them. With the Moon waxing,
// the Sun stands to the right of it (west, for someone facing the Moon from the northern
// hemisphere); waning, to the left. Altitudes the Sun-Moon angle can't allow are bent to the
// nearest that it can.
export function zenithFor(moonDirection: Vec3, sunDirection: Vec3, altitudes: { moon: number; sun: number }, isWaxing: boolean): Vec3 {
  const cosAngle = vec3.dot(moonDirection, sunDirection)
  const sinAngle = Math.sqrt(Math.max(0, 1 - cosAngle * cosAngle))
  const across = sinAngle > 1e-6 ? perpendicularUnit(sunDirection, moonDirection) : perpendicularUnit(ECLIPTIC_NORTH, moonDirection)
  const third = vec3.cross(vec3.create(), moonDirection, across)
  const alongMoon = Math.sin(degreesToRadians(altitudes.moon))
  const alongAcross = sinAngle > 1e-6 ? (Math.sin(degreesToRadians(altitudes.sun)) - alongMoon * cosAngle) / sinAngle : 0
  const sideways = Math.sqrt(Math.max(0, 1 - alongMoon * alongMoon - alongAcross * alongAcross)) * (isWaxing ? -1 : 1)
  const zenith = [0, 1, 2].map((i) => alongMoon * moonDirection[i] + alongAcross * across[i] + sideways * third[i])
  const unit = vec3.normalize(vec3.create(), zenith)
  return [unit[0], unit[1], unit[2]]
}

// The ground chapters' shot: from Earth's center toward the Moon, the horizon level under it.
export function moonGroundShot(moonPosition: ArrayLike<number>, altitudes: { moon: number; sun: number }, ageDegrees: number): GroundShot {
  const moonDirection = unitFromEarth(moonPosition)
  const sunDirection = unitFromEarth([0, 0, 0])
  const zenith = zenithFor(moonDirection, sunDirection, altitudes, waxing(ageDegrees))
  return {
    eye: PHASES_EARTH_POSITION,
    zenith,
    toward: perpendicularUnit(moonDirection, zenith),
    altitudes: { top: altitudes.moon + MOON_ANGULAR_RADIUS_DEGREES * 2.6, bottom: -1.5 },
  }
}

function unitFromEarth(point: ArrayLike<number>): Vec3 {
  const earth = PHASES_EARTH_POSITION
  const unit = vec3.normalize(vec3.create(), [point[0] - earth[0], point[1] - earth[1], point[2] - earth[2]])
  return [unit[0], unit[1], unit[2]]
}
