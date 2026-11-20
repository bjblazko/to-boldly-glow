import type { Vec3 } from '../math/tuples'
import { MODEL_VERTEX_FLOATS, type ModelData } from './modelFile'

// Where a ray first meets a model, in the model's own frame (metres): every triangle tested (a
// model has a few hundred thousand at most, and this runs on a double click), each assembly moved
// as far as the model is taken apart, and only the triangles the picture shows.

export interface PickState {
  // How far each assembly is moved out (its offset times how far the model is taken apart).
  moved: readonly Vec3[]
  // Whether an assembly shows at all (not faded away, not an inside left closed).
  shown: (assembly: number) => boolean
  // Whether a point of a shell lies in the quarter cut away (and so isn't there to hit).
  cutAway: (assembly: number, point: Vec3) => boolean
}

// The distance along the ray to the nearest hit, or null.
export function pickModel({ vertices, indices }: ModelData, origin: Vec3, direction: Vec3, state: PickState): number | null {
  let nearest: number | null = null
  for (let t = 0; t < indices.length; t += 3) {
    const assembly = vertices[indices[t] * MODEL_VERTEX_FLOATS + 8]
    if (!state.shown(assembly)) continue
    const corner = (k: number): Vec3 => {
      const o = indices[t + k] * MODEL_VERTEX_FLOATS
      const m = state.moved[assembly] ?? [0, 0, 0]
      return [vertices[o] + m[0], vertices[o + 1] + m[1], vertices[o + 2] + m[2]]
    }
    const distance = hitTriangle([corner(0), corner(1), corner(2)], origin, direction)
    if (distance === null || (nearest !== null && distance >= nearest)) continue
    const point: Vec3 = [origin[0] + direction[0] * distance, origin[1] + direction[1] * distance, origin[2] + direction[2] * distance]
    if (!state.cutAway(assembly, point)) nearest = distance
  }
  return nearest
}

// Möller-Trumbore: the distance to the triangle (both faces), or null.
function hitTriangle([a, b, c]: [Vec3, Vec3, Vec3], origin: Vec3, d: Vec3): number | null {
  const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
  const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
  const p = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]]
  const det = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2]
  if (Math.abs(det) < 1e-12) return null
  const s = [origin[0] - a[0], origin[1] - a[1], origin[2] - a[2]]
  const u = (s[0] * p[0] + s[1] * p[1] + s[2] * p[2]) / det
  if (u < 0 || u > 1) return null
  const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]]
  const v = (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]) / det
  if (v < 0 || u + v > 1) return null
  const distance = (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) / det
  return distance > 0 ? distance : null
}
