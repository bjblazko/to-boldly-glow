import { vec3 } from 'gl-matrix'
import { pointAlong, type Vec3 } from '../../math/tuples'
import { ECLIPTIC_NORTH } from '../../solarSystem/poleOrientation'
import type { GroundShot } from '../ground/groundShot'
import { perpendicularUnit, SUN_RADIUS } from './eclipseGeometry'

// The eclipse seen from the ground. The Sun stays at the origin; the observer stands far enough
// away for the Sun to look about ten times bigger than in the real sky - big enough to watch the
// Moon slide across it - with the Sun low over the horizon. The Moon is placed on the line of sight
// to show the stage's separation and size; Earth itself isn't drawn (the ground is painted by
// groundSkyShader.ts).

const OBSERVER_SUN_DISTANCE = 60
// The Sun's direction as seen from Earth on 2 August 2027, the next total eclipse: in the Lion,
// with Regulus about 20 degrees to its east - so the stars that come out are the real ones.
const SUN_ECLIPTIC_LONGITUDE_DEGREES = 130
const SUN_ALTITUDE_DEGREES = 12
const MOON_DISTANCE = 30
// Which way the Moon crosses the Sun: from the west (right), slightly upward.
const MOON_PATH_ANGLE_DEGREES = 15

const longitude = (SUN_ECLIPTIC_LONGITUDE_DEGREES * Math.PI) / 180
const altitude = (SUN_ALTITUDE_DEGREES * Math.PI) / 180

// From the observer toward the Sun.
export const SUNWARD: Vec3 = [Math.cos(longitude), Math.sin(longitude), 0]
export const OBSERVER: Vec3 = pointAlong([0, 0, 0], SUNWARD, -OBSERVER_SUN_DISTANCE)
// Straight up from the observer: tipped from ecliptic north so the Sun stands SUN_ALTITUDE above
// the horizon, which then runs level under it.
export const ZENITH: Vec3 = addScaled(scaled(SUNWARD, Math.sin(altitude)), ECLIPTIC_NORTH, Math.cos(altitude))
// Along the horizon toward the Sun, and to the right of it (west, for an observer facing the Sun).
export const TOWARD_SUN_ON_HORIZON = perpendicularUnit(SUNWARD, ZENITH)
const WEST = cross(TOWARD_SUN_ON_HORIZON, ZENITH)

export const SUN_ANGULAR_RADIUS = Math.asin(SUN_RADIUS / OBSERVER_SUN_DISTANCE)
// The real Sun's angular radius, for the lesson's note on how much bigger it looks here.
export const REAL_SUN_ANGULAR_RADIUS = (0.2666 * Math.PI) / 180

// Where the Moon stands for a stage: `separation` Sun radii west of the Sun's center along its
// path, at `sizeRatio` times the Sun's apparent size.
export function skyMoon(separation: number, sizeRatio: number): { position: Vec3; radius: number } {
  const pathAngle = (MOON_PATH_ANGLE_DEGREES * Math.PI) / 180
  const across = perpendicularUnit(addScaled(scaled(WEST, Math.cos(pathAngle)), ZENITH, -Math.sin(pathAngle)), SUNWARD)
  const offset = separation * SUN_ANGULAR_RADIUS
  const direction = addScaled(scaled(SUNWARD, Math.cos(offset)), across, Math.sin(offset))
  return {
    position: pointAlong(OBSERVER, direction, MOON_DISTANCE),
    radius: MOON_DISTANCE * Math.sin(sizeRatio * SUN_ANGULAR_RADIUS),
  }
}

// A point in the sky near the Sun, `up` and `left` Sun radii from its center (as the observer sees
// it), for labels.
export function besideTheSun(up: number, left: number): Vec3 {
  const upward = perpendicularUnit(ZENITH, SUNWARD)
  const leftward = cross(upward, SUNWARD)
  const offset = addScaled(scaled(upward, up * SUN_ANGULAR_RADIUS), leftward, left * SUN_ANGULAR_RADIUS)
  return pointAlong(OBSERVER, addScaled(SUNWARD, offset, 1), MOON_DISTANCE)
}

// The camera at the observer, facing the Sun: the picture reaches from a strip of ground below the
// horizon to a little more than two Sun radii above the Sun.
export const ECLIPSE_SKY_SHOT: GroundShot = {
  eye: OBSERVER,
  zenith: ZENITH,
  toward: TOWARD_SUN_ON_HORIZON,
  altitudes: { top: SUN_ALTITUDE_DEGREES + (2.2 * SUN_ANGULAR_RADIUS * 180) / Math.PI, bottom: -1.5 },
}

function scaled(v: ArrayLike<number>, factor: number): Vec3 {
  return [v[0] * factor, v[1] * factor, v[2] * factor]
}

function addScaled(a: ArrayLike<number>, b: ArrayLike<number>, factor: number): Vec3 {
  return [a[0] + b[0] * factor, a[1] + b[1] * factor, a[2] + b[2] * factor]
}

function cross(a: Vec3, b: Vec3): Vec3 {
  const out = vec3.cross(vec3.create(), a, b)
  return [out[0], out[1], out[2]]
}
