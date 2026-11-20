import { vec3, type ReadonlyVec3 } from 'gl-matrix'
import { orbitBasisForUpAxis, WALK_RADIUS, type OrbitCamera, type WalkLimit } from '../camera/orbitCamera'
import type { Vec3 } from '../math/tuples'

// Walking through a staged room (a cabin), and looking at a spot double-clicked: the orbit camera's pivot just ahead of the eye, every
// move of the eye stopped short of what stands in its way.

// How far along a ray (unit direction) something stands in the way, looking no farther than `within`.
export type Obstacle = (origin: Vec3, direction: Vec3, within: number) => number | null

// How close the eye may come to a wall or a couch (metres), and how far from a spot double-clicked
// it stops to look at it.
const KEEP_CLEAR = 0.1
const STAND_OFF = 0.35

export function walkLimit(obstacle: Obstacle): WalkLimit {
  return (eye: ReadonlyVec3, delta: ReadonlyVec3) => {
    const length = vec3.length(delta)
    if (length === 0) return vec3.create()
    const direction: Vec3 = [delta[0] / length, delta[1] / length, delta[2] / length]
    const hit = obstacle([eye[0], eye[1], eye[2]], direction, length + KEEP_CLEAR)
    const allowed = hit === null ? length : Math.max(0, Math.min(length, hit - KEEP_CLEAR))
    return vec3.scale(vec3.create(), direction, allowed)
  }
}

// Turns the framed view into a walk: the eye stays where the shot put it, looking the same way.
export function startWalking(orbit: OrbitCamera, limit: WalkLimit): void {
  const eye = orbit.getEyePosition()
  const ahead = orbit.forward()
  orbit.clearPan()
  vec3.scaleAndAdd(orbit.target, eye, ahead, WALK_RADIUS)
  orbit.radius = WALK_RADIUS
  orbit.walk = limit
}

// Walks up to a point (what a double click found): the eye goes along the clear line toward it and
// stops a little way off, looking at it.
export function walkUpTo(orbit: OrbitCamera, point: Vec3): void {
  const eye = orbit.getEyePosition()
  const toPoint = vec3.subtract(vec3.create(), point, eye)
  const distance = vec3.length(toPoint)
  if (distance === 0) return
  vec3.scale(toPoint, toPoint, 1 / distance)
  const standAt = vec3.scaleAndAdd(vec3.create(), eye, toPoint, Math.max(0, distance - STAND_OFF))
  orbit.clearPan()
  vec3.scaleAndAdd(orbit.target, standAt, toPoint, WALK_RADIUS)
  orbit.radius = WALK_RADIUS
  // The eye sits behind the pivot: from the pivot toward the eye is against the look.
  faceAlong(orbit, vec3.negate(vec3.create(), toPoint))
}

// Outside a room: circles a point from the side the camera is on, no farther than `maxRadius` - so
// the view never backs away through something.
export function circleSpot(orbit: OrbitCamera, point: Vec3, maxRadius: number): void {
  const toEye = vec3.subtract(vec3.create(), orbit.getEyePosition(), point)
  const distance = vec3.length(toEye)
  if (distance === 0) return
  orbit.clearPan()
  vec3.set(orbit.target, ...point)
  orbit.radius = Math.max(orbit.minRadius, Math.min(distance, maxRadius))
  faceAlong(orbit, vec3.scale(toEye, toEye, 1 / distance))
}

// Sets azimuth and elevation so the eye lies along `back` (a unit vector) from the pivot.
function faceAlong(orbit: OrbitCamera, back: ReadonlyVec3): void {
  const up: Vec3 = [orbit.upAxis[0], orbit.upAxis[1], orbit.upAxis[2]]
  const { right, forward0 } = orbitBasisForUpAxis(up)
  orbit.elevation = Math.asin(Math.max(-1, Math.min(1, vec3.dot(back, up))))
  orbit.azimuth = Math.atan2(vec3.dot(back, right), vec3.dot(back, forward0))
}
