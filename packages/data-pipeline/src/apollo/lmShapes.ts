import type { MeshPrimitive } from '../spacecraft/glbMesh'

// The flat-faced shapes the lunar module is made of (it has hardly a round surface): prisms of a
// polygon, boxes and plates. Each face is shaded flat. A face takes either one swatch of a palette
// or a stretch of a foil image laid flat over it (FOIL_METRES of the image's width per metre: one
// image covers a face up to that size, so it never has to repeat).

export type Point3 = readonly [number, number, number]

export const FOIL_METRES = 4.5

export interface Swatch {
  texture: string
  uv: [number, number]
}

export type Look =
  | Swatch // a palette swatch
  | { texture: string; foil: true; shift?: number } // a foil image, shifted to vary face from face
  | { texture: string; decal: true } // one whole image over a four-cornered face (bottom left first)

interface Face {
  corners: Point3[] // a convex polygon, in order
  normal: Point3
}

// The faces as one primitive: each a fan of triangles from its first corner.
export function facesMesh(faces: readonly Face[], look: Look): MeshPrimitive {
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  faces.forEach(({ corners, normal }, index) => {
    const first = positions.length / 3
    const foilUvs = 'foil' in look ? foilCoordinates(corners, normal, (look.shift ?? 0) + index * 0.37) : null
    corners.forEach((corner, k) => {
      positions.push(...corner)
      normals.push(...normal)
      uvs.push(...(foilUvs ? foilUvs[k] : 'decal' in look ? DECAL_UV[k % 4] : (look as Swatch).uv))
    })
    // The fan runs counter-clockwise seen from where the face looks (the renderer's front face).
    const turned = dot(polygonNormal(corners), normal) < 0
    for (let k = 1; k < corners.length - 1; k++) indices.push(...(turned ? [first, first + k + 1, first + k] : [first, first + k, first + k + 1]))
  })
  return { texture: look.texture, positions: Float32Array.from(positions), normals: Float32Array.from(normals), uvs: Float32Array.from(uvs), indices: Uint32Array.from(indices) }
}

const DECAL_UV: [number, number][] = [[0, 1], [1, 1], [1, 0], [0, 0]]

// A face's foil coordinates: its corners projected onto its plane, metres to image, the face placed
// somewhere inside the image (`shift`, 0 to 1, says where) so neighbouring faces don't look alike.
function foilCoordinates(corners: readonly Point3[], normal: Point3, shift: number): [number, number][] {
  const up: Point3 = Math.abs(normal[1]) > 0.9 ? [0, 0, 1] : [0, 1, 0]
  const across = normalize(cross(up, normal))
  const along = cross(normal, across)
  const flat = corners.map((corner) => [dot(corner, across) / FOIL_METRES, dot(corner, along) / FOIL_METRES])
  const place = (axis: number, turn: number) => {
    const values = flat.map((point) => point[axis])
    const [min, span] = [Math.min(...values), Math.max(...values) - Math.min(...values)]
    return (value: number) => value - min + ((shift * turn) % 1) * Math.max(0, 1 - span)
  }
  const [u, v] = [place(0, 1), place(1, 1.7)]
  return flat.map(([a, b]) => [u(a), v(b)])
}

// A plate (both faces drawn by the renderer): corners in order around it.
export function plate(corners: readonly Point3[], look: Look): MeshPrimitive {
  return facesMesh([{ corners: [...corners], normal: polygonNormal(corners) }], look)
}

// An upright prism: a convex outline (x, z) from `bottom` to `top`, walls facing out, both ends
// closed.
export function prism(outline: readonly (readonly [number, number])[], bottom: number, top: number, look: Look): MeshPrimitive {
  const cap = (y: number, normal: Point3): Face => ({ corners: outline.map(([x, z]) => [x, y, z] as Point3), normal })
  return facesMesh([...wallFaces(outline, bottom, top), cap(top, [0, 1, 0]), cap(bottom, [0, -1, 0])], look)
}

// The same prism's walls only, its ends left open (a room's walls, its end walls built apart).
export function walls(outline: readonly (readonly [number, number])[], bottom: number, top: number, look: Look): MeshPrimitive {
  return facesMesh(wallFaces(outline, bottom, top), look)
}

function wallFaces(outline: readonly (readonly [number, number])[], bottom: number, top: number): Face[] {
  const [cx, cz] = centroid(outline)
  return outline.map(([x0, z0], index) => {
    const [x1, z1] = outline[(index + 1) % outline.length]
    const normal = outwardNormal([x0, z0], [x1, z1], [cx, cz])
    return { corners: [[x0, bottom, z0], [x1, bottom, z1], [x1, top, z1], [x0, top, z0]], normal }
  })
}

// The part of a convex polygon where `side(point)` is zero or more (a straight cut across it).
export function clipConvex(points: readonly (readonly [number, number])[], side: (point: readonly [number, number]) => number): [number, number][] {
  const result: [number, number][] = []
  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length]
    const [a, b] = [side(point), side(next)]
    if (a >= 0) result.push([point[0], point[1]])
    if ((a >= 0) !== (b >= 0)) {
      const t = a / (a - b)
      result.push([point[0] + (next[0] - point[0]) * t, point[1] + (next[1] - point[1]) * t])
    }
  })
  return result
}

// A box between two corners, its sides along the axes.
export function box(min: Point3, max: Point3, look: Look): MeshPrimitive {
  return prism([[min[0], min[2]], [max[0], min[2]], [max[0], max[2]], [min[0], max[2]]], min[1], max[1], look)
}

// A regular polygon's corners (x, z) round a centre, the first at `startDegrees` from +Z toward +X.
export function polygon(sides: number, radius: number, [cx, cz]: readonly [number, number] = [0, 0], startDegrees = 0): [number, number][] {
  return Array.from({ length: sides }, (_, index) => {
    const angle = ((startDegrees + (index * 360) / sides) * Math.PI) / 180
    return [cx + radius * Math.sin(angle), cz + radius * Math.cos(angle)]
  })
}

function centroid(outline: readonly (readonly [number, number])[]): [number, number] {
  const sum = outline.reduce(([sx, sz], [x, z]) => [sx + x, sz + z], [0, 0])
  return [sum[0] / outline.length, sum[1] / outline.length]
}

function outwardNormal([x0, z0]: readonly [number, number], [x1, z1]: readonly [number, number], [cx, cz]: [number, number]): Point3 {
  const [nx, nz] = [z1 - z0, -(x1 - x0)]
  const length = Math.hypot(nx, nz)
  const sign = nx * ((x0 + x1) / 2 - cx) + nz * ((z0 + z1) / 2 - cz) < 0 ? -1 : 1
  return [(sign * nx) / length, 0, (sign * nz) / length]
}

export function polygonNormal(corners: readonly Point3[]): Point3 {
  const [a, b, c] = corners
  return normalize(cross([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [c[0] - a[0], c[1] - a[1], c[2] - a[2]]))
}

function cross(a: Point3, b: Point3): Point3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

function dot(a: Point3, b: Point3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function normalize(v: Point3): Point3 {
  const length = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / length, v[1] / length, v[2] / length]
}

// A shape built upright, laid along +Z instead (y and z swapped: its outline's z becomes height),
// then moved by `offset`.
export function laidAlongZ(primitive: MeshPrimitive, offset: Point3): MeshPrimitive {
  const swap = (values: Float32Array, add: Point3) => {
    const result = new Float32Array(values.length)
    for (let i = 0; i < values.length; i += 3) result.set([values[i] + add[0], values[i + 2] + add[1], values[i + 1] + add[2]], i)
    return result
  }
  // Swapping two axes mirrors the shape: each triangle's corners are put back in front-face order.
  const indices = new Uint32Array(primitive.indices.length)
  for (let t = 0; t < indices.length; t += 3) indices.set([primitive.indices[t], primitive.indices[t + 2], primitive.indices[t + 1]], t)
  return { ...primitive, positions: swap(primitive.positions, offset), normals: swap(primitive.normals, [0, 0, 0]), indices }
}

// Every triangle put in front-face order for the way its normal points (a lathe's profile running
// downward, as a dish's inner face does, otherwise leaves its faces turned the wrong way round, and
// the renderer draws a shell seen from behind dark).
export function facingNormals(primitive: MeshPrimitive): MeshPrimitive {
  const { positions: p, normals: n, indices } = primitive
  const turned = new Uint32Array(indices)
  for (let t = 0; t < turned.length; t += 3) {
    const [a, b, c] = [turned[t] * 3, turned[t + 1] * 3, turned[t + 2] * 3]
    const u: Point3 = [p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]]
    const v: Point3 = [p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]]
    if (dot(cross(u, v), [n[a], n[a + 1], n[a + 2]]) < 0) turned.set([turned[t], turned[t + 2], turned[t + 1]], t)
  }
  return { ...primitive, indices: turned }
}
