import { mat4 } from 'gl-matrix'
import { orbitBasisForUpAxis } from '../../camera/orbitCamera'
import type { Vec3 } from '../../math/tuples'
import type { LessonShot } from '../lessonShot'
import { CLOSEUPS, type CloseupId } from './closeupChoreography'
import { LANDING_SITE, RENDEZVOUS, ROUTE_MOON, routePoint, UNDOCKING } from './routeGeometry'

// Where each close-up plays in the scene: at the craft's place on the drawn route (or at
// Tranquility Base), its frame's +Y along the flight (or straight up from the Moon), +Z toward
// ecliptic north (the route's plane is the ecliptic) - and how big. The vehicles are drawn hugely
// enlarged, as the route itself is (a few hundred metres to an Earth radius out in space, about two
// thousand on the Moon's ground, so it looks flat under Eagle).
const SPACE_SCALE = 0.01 // scene units per metre
const GROUND_SCALE = 0.002
const NORTH: Vec3 = [0, 0, 1]

interface Frame {
  origin: Vec3
  // The frame's axes in the scene.
  x: Vec3
  y: Vec3
  z: Vec3
  scale: number
}

const PLACES: Record<CloseupId, { progress: number } | 'site'> = {
  transposition: { progress: 2.08 },
  undocking: { progress: UNDOCKING },
  landing: 'site',
  liftoff: 'site',
  rendezvous: { progress: RENDEZVOUS },
  entry: { progress: 4.88 },
}

const sub = (a: ArrayLike<number>, b: ArrayLike<number>): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: ArrayLike<number>, b: ArrayLike<number>) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: ArrayLike<number>, b: ArrayLike<number>): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const unit = (v: ArrayLike<number>): Vec3 => {
  const n = Math.hypot(v[0], v[1], v[2])
  return [v[0] / n, v[1] / n, v[2] / n]
}

export function closeupFrame(id: CloseupId): Frame {
  const place = PLACES[id]
  if (place === 'site') {
    const y = unit(sub(LANDING_SITE, ROUTE_MOON))
    return { origin: LANDING_SITE, x: cross(y, NORTH), y, z: NORTH, scale: GROUND_SCALE }
  }
  const y = unit(sub(routePoint(place.progress + 1e-4), routePoint(place.progress - 1e-4)))
  return { origin: routePoint(place.progress), x: cross(y, NORTH), y, z: NORTH, scale: SPACE_SCALE }
}

// The frame (metres) to the scene - or, given the eye, to the scene moved so the eye is at its
// origin: the difference is taken in double precision, so float32 never holds the close-up's
// distance from the scene's origin (hundreds of units, millimetres apart at this scale).
export function frameMatrix(frame: Frame, eye: ArrayLike<number> = [0, 0, 0]): mat4 {
  const { x, y, z, origin, scale: s } = frame
  return mat4.fromValues(x[0] * s, x[1] * s, x[2] * s, 0, y[0] * s, y[1] * s, y[2] * s, 0, z[0] * s, z[1] * s, z[2] * s, 0, origin[0] - eye[0], origin[1] - eye[1], origin[2] - eye[2], 1)
}

export function framePoint(frame: Frame, point: ArrayLike<number>): Vec3 {
  const { x, y, z, origin, scale: s } = frame
  return [0, 1, 2].map((k) => origin[k] + s * (x[k] * point[0] + y[k] * point[1] + z[k] * point[2])) as Vec3
}

// Toward the Sun (at the scene's origin) from the close-up.
export function closeupToSun(id: CloseupId): Vec3 {
  return unit(closeupFrame(id).origin.map((value) => -value))
}

// From the side, a little from above, on the sunlit side: in space across the flight; on the
// ground across Eagle's way in, its horizon level.
export function closeupShot(id: CloseupId): LessonShot {
  const frame = closeupFrame(id)
  const { center, reach } = CLOSEUPS[id]
  const toSun = closeupToSun(id)
  const onGround = PLACES[id] === 'site'
  const up = onGround ? frame.y : frame.z
  const across = onGround ? frame.z : frame.x
  const side = dot(across, toSun) >= 0 ? across : across.map((value) => -value)
  const eye = unit(side.map((value, k) => value + 0.35 * up[k] + 0.25 * frame.y[k] * (onGround ? 0 : 1)))
  const { right, forward0 } = orbitBasisForUpAxis(up)
  const size = reach * frame.scale
  return {
    key: `apollo-closeup-${id}`,
    preset: { target: framePoint(frame, center), radius: size * 2.6, azimuth: Math.atan2(dot(eye, right), dot(eye, forward0)), elevation: Math.asin(dot(eye, up)), upAxis: up },
    bounds: { top: size * 0.55, bottom: -size * 0.55, halfWidth: size * 0.7 },
    maxZoomOut: 4,
    // Close enough to look the vehicles over, far enough to keep the depth buffer fine (its near
    // plane follows the zoom floor).
    zoomFloor: size * 0.6,
    freeLook: true,
  }
}
