import { mat4, vec3 } from 'gl-matrix'
import type { Viewpoint } from '../../camera/viewpoint'
import type { LensShift } from '../../camera/viewpoint'
import type { Vec3 } from '../../math/tuples'

// The craft are drawn in a pass of their own, in metres: around the camera (so float32 keeps
// millimetres), with a near and far plane of their own, and their depth squeezed into the front
// sliver [0, CRAFT_DEPTH] of the one depth buffer (a hundredth: some 170,000 steps of a 24-bit
// buffer) - in front of every body, which the world's
// projection puts at depths near 1 (the craft are never behind Earth or the Moon from where the
// camera is: they are always within a few kilometres of it, the bodies hundreds away).

export const CRAFT_DEPTH = 0.01

export function squeezedProjection({ fov, aspect, near, far, lensShift }: { fov: number; aspect: number; near: number; far: number; lensShift?: LensShift }): mat4 {
  const m = mat4.perspectiveZO(mat4.create(), fov, aspect, near, far)
  for (const i of [2, 6, 10, 14]) m[i] *= CRAFT_DEPTH
  m[8] = -(lensShift?.x ?? 0)
  m[9] = -(lensShift?.y ?? 0)
  return m
}

// The world's camera, turned only (the eye at the origin), with the craft's projection.
export function craftViewpoint(world: Viewpoint, projection: mat4): Viewpoint {
  const view = mat4.clone(world.view)
  view[12] = view[13] = view[14] = 0
  return { ...world, view, projection, viewProjection: mat4.multiply(mat4.create(), projection, view), position: vec3.create() }
}

// How much sunlight reaches a point (1: all, 0: in a body's umbra): each body's shadow as a
// cylinder behind it, its edge softened by the Sun's width (half a degree) with the distance.
const SUN_ANGLE = 0.0093
export function sunlit(pointKm: Vec3, bodies: { centreKm: Vec3; radiusKm: number }[], toSun: Vec3): number {
  return bodies.reduce((light, { centreKm, radiusKm }) => {
    const r = vec3.sub(vec3.create(), pointKm, centreKm)
    const behind = -vec3.dot(r, toSun)
    if (behind <= 0) return light
    const off = Math.hypot(r[0] + behind * toSun[0], r[1] + behind * toSun[1], r[2] + behind * toSun[2])
    const width = Math.max(1, behind * SUN_ANGLE)
    const u = Math.min(1, Math.max(0, (off - (radiusKm - width / 2)) / width))
    return Math.min(light, u * u * (3 - 2 * u))
  }, 1)
}
