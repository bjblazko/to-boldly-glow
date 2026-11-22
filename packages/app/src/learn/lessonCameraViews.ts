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

// A ball the camera must not fly into (a planet, a moon).
export interface KeepOut {
  center: Vec3
  radius: number
}

// The view, its eye moved out onto any ball it has strayed into, and - close over a ball - what it
// looks at slid out onto its surface: a flight between two shots passes over a planet instead of
// through it (from inside its drawn sphere nothing shows, so the camera would seem to see through).
export function keepOutside(view: CameraView, up: ArrayLike<number>, balls: readonly KeepOut[]): CameraView {
  const upAxis: Vec3 = [up[0], up[1], up[2]]
  const start = eyeOf(view, upAxis)
  const eye = balls.reduce((point, ball) => outOf(point, ball, upAxis), start)
  const target = balls.reduce((point, ball) => surfacedNear(point, ball, start), view.target)
  return eye === start && target === view.target ? view : lookingFrom({ ...view, target }, eye, upAxis)
}

// A point inside the ball, moved out toward its surface the closer the eye comes: all the way once
// the eye is within a tenth of the radius above it, not at all from half the radius up.
function surfacedNear(point: Vec3, { center, radius }: KeepOut, eye: Vec3): Vec3 {
  const fromCenter = vec3.subtract(vec3.create(), point, center)
  const depth = vec3.length(fromCenter)
  const nearness = Math.min(1, Math.max(0, (1.5 * radius - vec3.distance(eye, center)) / (0.4 * radius)))
  if (depth >= radius || nearness === 0) return point
  const way = depth > 0 ? vec3.scale(fromCenter, fromCenter, 1 / depth) : vec3.normalize(vec3.create(), vec3.subtract(vec3.create(), eye, center))
  return [0, 1, 2].map((k) => point[k] + (center[k] + way[k] * radius - point[k]) * nearness) as Vec3
}

// The view turned to look at a point from where its eye stands.
export function aimedAt(view: CameraView, point: Vec3, up: ArrayLike<number>): CameraView {
  const upAxis: Vec3 = [up[0], up[1], up[2]]
  return lookingFrom({ ...view, target: point }, eyeOf(view, upAxis), upAxis)
}

function eyeOf(view: CameraView, upAxis: Vec3): Vec3 {
  const { right, forward0 } = orbitBasisForUpAxis(upAxis)
  const along = (k: number) => Math.cos(view.elevation) * (Math.sin(view.azimuth) * right[k] + Math.cos(view.azimuth) * forward0[k]) + Math.sin(view.elevation) * upAxis[k]
  return [0, 1, 2].map((k) => view.target[k] + view.radius * along(k)) as Vec3
}

// The point, or - inside the ball - the nearest point on its surface.
function outOf(point: Vec3, { center, radius }: KeepOut, upAxis: Vec3): Vec3 {
  const out = vec3.subtract(vec3.create(), point, center)
  const distance = vec3.length(out)
  if (distance >= radius) return point
  const direction = distance > 0 ? vec3.scale(out, out, 1 / distance) : upAxis
  return [0, 1, 2].map((k) => center[k] + direction[k] * radius) as Vec3
}

// The view's target and lens, seen from the given eye.
function lookingFrom(view: CameraView, eye: Vec3, upAxis: Vec3): CameraView {
  const { right, forward0 } = orbitBasisForUpAxis(upAxis)
  const back = vec3.subtract(vec3.create(), eye, view.target)
  const length = vec3.length(back)
  const component = (axis: ArrayLike<number>) => (back[0] * axis[0] + back[1] * axis[1] + back[2] * axis[2]) / length
  return { ...view, radius: length, azimuth: Math.atan2(component(right), component(forward0)), elevation: Math.asin(Math.max(-1, Math.min(1, component(upAxis)))) }
}
