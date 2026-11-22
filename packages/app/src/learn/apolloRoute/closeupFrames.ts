import { mat4, vec3 } from 'gl-matrix'
import { generateSphereMesh, SPHERE_SEGMENTS } from '../../bodies/sphereMesh'
import { bodyWorldMatrix } from '../../scene/sceneLayout'
import { routeMoonPose } from './apolloRouteScene'
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
// On the ground the Moon is drawn this big (about 900 m in radius), so the flat facet
// of its drawn sphere under Eagle reaches past the picture: the ground looks flat, as it was.
const GROUND_SCALE = 0.0006
const NORTH: Vec3 = [0, 0, 1]
// Metres: enough to stay clear of the drawn ground, too little to see.
const SHADOW_LIFT = 0.15

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
    const { point, normal: y } = groundUnderSite()
    const z = unit(sub(NORTH, y.map((value) => value * dot(NORTH, y))))
    return { origin: point, x: cross(y, z), y, z, scale: GROUND_SCALE }
  }
  const y = unit(sub(routePoint(place.progress + 1e-4), routePoint(place.progress - 1e-4)))
  return { origin: routePoint(place.progress), x: cross(y, NORTH), y, z: NORTH, scale: SPACE_SCALE }
}

let ground: { point: Vec3; normal: Vec3 } | null = null

// Where the line from the Moon's centre through the landing site meets the Moon as it is drawn - a
// sphere of flat triangles (bodies/sphereMesh.ts) - and that triangle's outward normal: Eagle
// stands on it, neither above nor sunk into the drawn ground.
export function groundUnderSite(): { point: Vec3; normal: Vec3 } {
  if (ground) return ground
  const world = bodyWorldMatrix(routeMoonPose())
  const mesh = generateSphereMesh(1, SPHERE_SEGMENTS, SPHERE_SEGMENTS)
  const corner = (index: number): Vec3 => {
    const p = vec3.transformMat4(vec3.create(), mesh.positions.subarray(index * 3, index * 3 + 3), world)
    return [p[0], p[1], p[2]]
  }
  const toward = unit(sub(LANDING_SITE, ROUTE_MOON))
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const [a, b, c] = [corner(mesh.indices[i]), corner(mesh.indices[i + 1]), corner(mesh.indices[i + 2])]
    const hit = rayHits(ROUTE_MOON, toward, [a, b, c])
    if (hit === null) continue
    const n = unit(cross(sub(b, a), sub(c, a)))
    ground = { point: ROUTE_MOON.map((value, k) => value + toward[k] * hit) as Vec3, normal: dot(n, toward) < 0 ? n.map((value) => -value) as Vec3 : n }
    return ground
  }
  throw new Error('The landing site is not under any of the Moon’s triangles.')
}

// How far along the ray it meets the triangle (Möller-Trumbore), or null.
function rayHits(origin: Vec3, direction: Vec3, [a, b, c]: Vec3[]): number | null {
  const [e1, e2] = [sub(b, a), sub(c, a)]
  const p = cross(direction, e2)
  const det = dot(e1, p)
  if (Math.abs(det) < 1e-12) return null
  const s = sub(origin, a)
  const u = dot(s, p) / det
  const q = cross(s, e1)
  const v = dot(direction, q) / det
  const t = dot(e2, q) / det
  return u < 0 || v < 0 || u + v > 1 || t <= 0 ? null : t
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

// Whether the close-up stands on the Moon's ground (its frame's +Y straight up).
export function onGround(id: CloseupId): boolean {
  return PLACES[id] === 'site'
}

// Lays a model flat on the ground (the frame's y = 0) along the sunlight, a hair above it: what
// draws a shadow. Null while the Sun is down.
export function groundShadowMatrix(id: CloseupId): mat4 | null {
  const frame = closeupFrame(id)
  const toSun = closeupToSun(id)
  const [lx, ly, lz] = [dot(toSun, frame.x), dot(toSun, frame.y), dot(toSun, frame.z)]
  if (ly < 0.02) return null
  return mat4.fromValues(1, 0, 0, 0, -lx / ly, 0, -lz / ly, 0, 0, 0, 1, 0, 0, SHADOW_LIFT, 0, 1)
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
  const ground = onGround(id)
  const up = ground ? frame.y : frame.z
  const across = ground ? frame.z : frame.x
  const side = dot(across, toSun) >= 0 ? across : across.map((value) => -value)
  const eye = unit(side.map((value, k) => value + (ground ? 0.2 : 0.35) * up[k] + 0.25 * frame.y[k] * (ground ? 0 : 1)))
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
