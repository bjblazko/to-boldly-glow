import { vec3, type ReadonlyVec3 } from 'gl-matrix'
import { orbitBasisForUpAxis, type OrbitCamera } from '../camera/orbitCamera'
import type { LensShift } from '../camera/viewpoint'
import { lerp, lerpVec3 } from '../math/easing'
import type { Vec3 } from '../math/tuples'

// The lesson camera's views, and the flights between them.

// A camera's place and look without angles: where it pivots, how far back, and the way back to the eye.
export interface Snapshot {
  pivot: Vec3
  radius: number
  back: Vec3
  lensShift: LensShift
  // The angles as they were, about the up axis as it was: used as they are if that axis stays.
  view: CameraView
  upAxis: Vec3
}

export interface CameraView {
  target: Vec3
  radius: number
  azimuth: number
  elevation: number
  lensShift: LensShift
}

// The target and angles ease along evenly; the distance by the same factor each step, so a flight
// from the whole lineup down to little Mercury doesn't rush through the close-up end.
export function blendViews(from: CameraView, to: CameraView, t: number): CameraView {
  return {
    target: lerpVec3(from.target, to.target, t),
    radius: Math.exp(lerp(Math.log(from.radius), Math.log(to.radius), t)),
    azimuth: lerp(from.azimuth, to.azimuth, t),
    elevation: lerp(from.elevation, to.elevation, t),
    lensShift: { x: lerp(from.lensShift.x, to.lensShift.x, t), y: lerp(from.lensShift.y, to.lensShift.y, t) },
  }
}

// Where the camera is now, free of which way is up - walking turns the up axis with the view, so
// a flight from here counts its angles about the up axis of where it goes (see viewAbout).
export function cameraSnapshot(orbit: OrbitCamera, lensShift: LensShift): Snapshot {
  const pivot = orbit.pivot()
  const back = vec3.normalize(vec3.create(), vec3.subtract(vec3.create(), orbit.getEyePosition(), pivot))
  const target: Vec3 = [pivot[0], pivot[1], pivot[2]]
  const view = { target, radius: orbit.radius, azimuth: orbit.azimuth, elevation: orbit.elevation, lensShift }
  return { pivot: target, radius: orbit.radius, back: [back[0], back[1], back[2]], lensShift, view, upAxis: [orbit.upAxis[0], orbit.upAxis[1], orbit.upAxis[2]] }
}

export function viewAbout(snapshot: Snapshot, upAxis: ReadonlyVec3): CameraView {
  if (snapshot.upAxis.every((value, axis) => value === upAxis[axis])) return { ...snapshot.view }
  const { pivot, radius, back, lensShift } = snapshot
  const up: Vec3 = [upAxis[0], upAxis[1], upAxis[2]]
  const { right, forward0 } = orbitBasisForUpAxis(up)
  const along = (axis: Vec3) => back[0] * axis[0] + back[1] * axis[1] + back[2] * axis[2]
  return { target: pivot, radius, azimuth: Math.atan2(along(right), along(forward0)), elevation: Math.asin(Math.max(-1, Math.min(1, along(up)))), lensShift }
}
