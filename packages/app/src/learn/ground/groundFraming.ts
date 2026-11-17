import { orbitBasisForUpAxis } from '../../camera/orbitCamera'
import { pointAlong, type Vec3 } from '../../math/tuples'
import type { CameraPreset, ContentBounds } from '../lessonShot'
import { directionAtAltitude, lookAltitudeDegrees, type GroundShot } from './groundShot'

// From the ground: standing at the shot's eye and looking toward the middle of what it must show,
// with the horizon level.
const GROUND_TARGET_DISTANCE = 10
// How wide the ground view is kept, either side of the look direction.
const GROUND_HALF_WIDTH_DEGREES = 12

export function groundPreset(shot: GroundShot): CameraPreset {
  const look = directionAtAltitude(shot, lookAltitudeDegrees(shot))
  const { right, forward0 } = orbitBasisForUpAxis(shot.zenith)
  const back = look.map((value) => -value) as Vec3
  const dot = (a: ArrayLike<number>, b: ArrayLike<number>) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  return {
    target: pointAlong(shot.eye, look, GROUND_TARGET_DISTANCE),
    radius: GROUND_TARGET_DISTANCE,
    azimuth: Math.atan2(dot(back, right), dot(back, forward0)),
    elevation: Math.asin(dot(back, shot.zenith)),
    upAxis: shot.zenith,
  }
}

// From the look direction, up to the shot's top altitude and down to its bottom one.
export function groundBounds(shot: GroundShot): ContentBounds {
  const look = lookAltitudeDegrees(shot)
  const across = (degrees: number) => GROUND_TARGET_DISTANCE * Math.tan((degrees * Math.PI) / 180)
  return { top: across(shot.altitudes.top - look), bottom: -across(look - shot.altitudes.bottom), halfWidth: across(GROUND_HALF_WIDTH_DEGREES) }
}
