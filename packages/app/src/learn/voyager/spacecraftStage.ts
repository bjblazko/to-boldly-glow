import { mat4 } from 'gl-matrix'
import { sunPose } from '../../scene/exploreLayout'
import type { SceneLayout } from '../../scene/sceneLayout'
import type { Ephemeris } from '../../time/ephemeris'
import type { Vec3 } from '../../math/tuples'

// The probe and the record are shown on their own, the Sun far off to the upper left behind the
// camera's shoulder: it lights them from the front, and its glow stays out of the picture.
export const TOWARD_SUN: Vec3 = normalized([-0.55, 0.5, 0.67])
const SUN_DISTANCE = 1500

// The scene around a spacecraft: only the Sun (its light), no planets.
export function spacecraftLayout(ephemeris: Ephemeris): SceneLayout {
  const sun = sunPose(ephemeris, 1)
  return { sun: { ...sun, position: TOWARD_SUN.map((value) => value * SUN_DISTANCE) as Vec3 }, planets: [], moons: [] }
}

// Turns a model about its own up axis (+Y) and scales it into the scene.
export function turntableMatrix(angleRadians: number, scale: number): mat4 {
  const matrix = mat4.fromYRotation(mat4.create(), angleRadians)
  return mat4.scale(matrix, matrix, [scale, scale, scale])
}

export function transformPoint(matrix: mat4, point: ArrayLike<number>): Vec3 {
  const [x, y, z] = [point[0], point[1], point[2]]
  return [
    matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
    matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
    matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
  ]
}

function normalized(vector: Vec3): Vec3 {
  const length = Math.hypot(...vector)
  return vector.map((value) => value / length) as Vec3
}
