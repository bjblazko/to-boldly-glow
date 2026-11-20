import type { MeshPrimitive } from '../spacecraft/glbMesh'

// A point of a profile: its distance from the axis and its height, in metres.
export type ProfilePoint = readonly [radius: number, height: number]

// Where a vertex samples its texture, from where it sits on the surface: its distance from the
// axis, its height and how far around it is (0 to 1).
export type UvMapping = (radius: number, height: number, around: number) => [number, number]

export interface LatheOptions {
  texture: string
  uv: UvMapping
  segments: number
  // The axis's place in the horizontal plane (x, z); default the origin.
  axis?: readonly [number, number]
  // The angle the first segment starts at (radians, from +X toward +Z).
  startAngle?: number
  // How far round it sweeps (radians; once round by default): a patch of a surface of revolution.
  sweep?: number
  // Each stretch of the profile shaded on its own (a stepped body); otherwise smooth (a dome, a
  // bell).
  sharp?: boolean
}

// A surface of revolution: the profile swept once around a vertical axis. Faces point away from
// the axis while the profile runs upward (a closed body's profile runs from the bottom up).
export function latheMesh(profile: readonly ProfilePoint[], options: LatheOptions): MeshPrimitive {
  const rings = options.sharp ? sharpRings(profile) : smoothRings(profile)
  return sweep(rings, options)
}

interface Ring {
  point: ProfilePoint
  // The surface's normal in the profile's plane: outward (along the radius) and up.
  normal: readonly [number, number]
}

// One stretch after another, each from its own pair of rings.
function sharpRings(profile: readonly ProfilePoint[]): Ring[][] {
  const stretches: Ring[][] = []
  for (let index = 0; index + 1 < profile.length; index++) {
    const normal = profileNormal(profile[index], profile[index + 1])
    stretches.push([{ point: profile[index], normal }, { point: profile[index + 1], normal }])
  }
  return stretches
}

// The whole profile as one strip, each point's normal from its two neighbours.
function smoothRings(profile: readonly ProfilePoint[]): Ring[][] {
  const last = profile.length - 1
  return [profile.map((point, index) => ({ point, normal: profileNormal(profile[Math.max(index - 1, 0)], profile[Math.min(index + 1, last)]) }))]
}

function profileNormal([r0, y0]: ProfilePoint, [r1, y1]: ProfilePoint): [number, number] {
  const [dr, dy] = [r1 - r0, y1 - y0]
  const length = Math.hypot(dr, dy) || 1
  return [dy / length, -dr / length]
}

interface Vertices {
  positions: number[]
  normals: number[]
  uvs: number[]
}

function sweep(strips: Ring[][], options: LatheOptions): MeshPrimitive {
  const vertices: Vertices = { positions: [], normals: [], uvs: [] }
  const indices: number[] = []
  for (const strip of strips) {
    const base = vertices.positions.length / 3
    for (const ring of strip) addRing(ring, options, vertices)
    addQuads(base, strip.length, options.segments, indices)
  }
  const { positions, normals, uvs } = vertices
  return { texture: options.texture, positions: Float32Array.from(positions), normals: Float32Array.from(normals), uvs: Float32Array.from(uvs), indices: Uint32Array.from(indices) }
}

// segments + 1 vertices around: the last repeats the first, so the texture wraps without a seam.
function addRing({ point: [radius, height], normal: [outward, up] }: Ring, options: LatheOptions, { positions, normals, uvs }: Vertices): void {
  const [axisX, axisZ] = options.axis ?? [0, 0]
  for (let segment = 0; segment <= options.segments; segment++) {
    const around = segment / options.segments
    const angle = (options.startAngle ?? 0) + around * (options.sweep ?? 2 * Math.PI)
    const [cos, sin] = [Math.cos(angle), Math.sin(angle)]
    positions.push(axisX + radius * cos, height, axisZ + radius * sin)
    normals.push(outward * cos, up, outward * sin)
    uvs.push(...options.uv(radius, height, around))
  }
}

// Two triangles per quad, wound counter-clockwise seen from the normal's side.
function addQuads(base: number, ringCount: number, segments: number, indices: number[]): void {
  const stride = segments + 1
  for (let ring = 0; ring + 1 < ringCount; ring++) {
    for (let segment = 0; segment < segments; segment++) {
      const a = base + ring * stride + segment
      const [b, c, d] = [a + stride, a + 1, a + stride + 1]
      indices.push(a, b, c, c, b, d)
    }
  }
}

// Joins primitives that share a texture into one.
export function mergePrimitives(primitives: readonly MeshPrimitive[]): MeshPrimitive {
  const vertexCounts = primitives.map((primitive) => primitive.positions.length / 3)
  const offsets = vertexCounts.map((_, index) => vertexCounts.slice(0, index).reduce((sum, count) => sum + count, 0))
  return {
    texture: primitives[0].texture,
    positions: concat(primitives.map((primitive) => primitive.positions)),
    normals: concat(primitives.map((primitive) => primitive.normals)),
    uvs: concat(primitives.map((primitive) => primitive.uvs)),
    indices: Uint32Array.from(primitives.flatMap((primitive, index) => [...primitive.indices].map((vertex) => vertex + offsets[index]))),
  }
}

function concat(arrays: Float32Array[]): Float32Array {
  const result = new Float32Array(arrays.reduce((sum, array) => sum + array.length, 0))
  let offset = 0
  for (const array of arrays) {
    result.set(array, offset)
    offset += array.length
  }
  return result
}
