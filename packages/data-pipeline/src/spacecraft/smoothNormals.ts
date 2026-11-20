import type { MeshPrimitive } from './glbMesh'

// Smooth normals for a scanned, simplified mesh: each vertex's normal becomes the area-weighted
// mean of the faces that meet at its place - across texture seams and between parts, which split a
// scan into many vertices at one point - leaving out faces bent more than `creaseDegrees` away from
// the vertex's own, so real edges (a switch, a panel's rim) stay sharp. Positions closer than
// `weld` count as one place.

export interface SmoothOptions {
  creaseDegrees: number
  weld: number
}

interface Face {
  // Area-weighted normal (its length is twice the face's area).
  normal: [number, number, number]
}

export function smoothNormals(primitives: readonly MeshPrimitive[], { creaseDegrees, weld }: SmoothOptions): MeshPrimitive[] {
  const faces = primitives.map(faceNormals)
  const facesAt = facesByPlace(primitives, weld)
  const crease = Math.cos((creaseDegrees * Math.PI) / 180)
  return primitives.map((primitive, part) => ({ ...primitive, normals: smoothed(primitive, part, { faces, facesAt, crease, weld }) }))
}

function faceNormals({ positions, indices }: MeshPrimitive): Face[] {
  const faces: Face[] = []
  for (let t = 0; t < indices.length; t += 3) {
    const [a, b, c] = [indices[t] * 3, indices[t + 1] * 3, indices[t + 2] * 3]
    const u = [positions[b] - positions[a], positions[b + 1] - positions[a + 1], positions[b + 2] - positions[a + 2]]
    const v = [positions[c] - positions[a], positions[c + 1] - positions[a + 1], positions[c + 2] - positions[a + 2]]
    faces.push({ normal: [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]] })
  }
  return faces
}

function placeKey(positions: Float32Array, vertex: number, weld: number): string {
  return `${Math.round(positions[vertex * 3] / weld)},${Math.round(positions[vertex * 3 + 1] / weld)},${Math.round(positions[vertex * 3 + 2] / weld)}`
}

// Every face that touches each place, as (part, face) pairs.
function facesByPlace(primitives: readonly MeshPrimitive[], weld: number): Map<string, [number, number][]> {
  const at = new Map<string, [number, number][]>()
  primitives.forEach(({ positions, indices }, part) => {
    for (let t = 0; t < indices.length; t++) {
      const key = placeKey(positions, indices[t], weld)
      const list = at.get(key) ?? []
      list.push([part, Math.floor(t / 3)])
      at.set(key, list)
    }
  })
  return at
}

interface Context {
  faces: Face[][]
  facesAt: Map<string, [number, number][]>
  crease: number
  weld: number
}

function smoothed({ positions, indices }: MeshPrimitive, part: number, context: Context): Float32Array {
  const own = ownDirections(indices, context.faces[part], positions.length / 3)
  const normals = new Float32Array(positions.length)
  for (let vertex = 0; vertex < positions.length / 3; vertex++) {
    const reference = unit([own[vertex * 3], own[vertex * 3 + 1], own[vertex * 3 + 2]])
    normals.set(meanAt(placeKey(positions, vertex, context.weld), reference, context), vertex * 3)
  }
  return normals
}

// Each vertex's own direction: the sum of the faces that use this very vertex.
function ownDirections(indices: Uint32Array, faces: Face[], vertexCount: number): Float32Array {
  const own = new Float32Array(vertexCount * 3)
  for (let t = 0; t < indices.length; t++) {
    const normal = faces[Math.floor(t / 3)].normal
    for (let k = 0; k < 3; k++) own[indices[t] * 3 + k] += normal[k]
  }
  return own
}

// The mean of the faces at a place within the crease of `reference` (the reference itself if none).
function meanAt(key: string, reference: number[], { faces, facesAt, crease }: Context): number[] {
  const sum = [0, 0, 0]
  for (const [part, face] of facesAt.get(key) ?? []) {
    const normal = faces[part][face].normal
    if (dot(unit(normal), reference) < crease) continue
    for (let k = 0; k < 3; k++) sum[k] += normal[k]
  }
  return sum[0] || sum[1] || sum[2] ? unit(sum) : reference
}

function unit(v: number[]): number[] {
  const length = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / length, v[1] / length, v[2] / length]
}

function dot(a: number[], b: number[]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}
