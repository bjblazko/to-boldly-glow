import type { ModelData } from '../../spacecraft/modelFile'
import { random, type Boulder } from './craterField'

// The boulders round Tranquility Base (craterField.ts's boulderField) as one model: each an
// irregular, faceted rock - an icosahedron split once, each corner pushed in or out by its own
// random numbers, squat rather than round - turned, set on the ground a little sunk into it, and
// wearing the ground's photo where it lies (the shader's regolith grain on it too). In metres in the
// Moon's own axes, from the site, as the ground and the terrain.

type V3 = [number, number, number]

const DEG = Math.PI / 180

// The icosahedron's faces, each split into four: 80 triangles of unit vectors.
function rockFaces(): V3[][] {
  const t = (1 + Math.sqrt(5)) / 2
  const p: V3[] = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]]
  const faces = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]]
  const unit = (v: number[]): V3 => {
    const l = Math.hypot(v[0], v[1], v[2])
    return [v[0] / l, v[1] / l, v[2] / l]
  }
  const mid = (a: V3, b: V3) => unit([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2])
  return faces.flatMap(([i, j, k]) => {
    const [a, b, c] = [unit(p[i]), unit(p[j]), unit(p[k])]
    const [ab, bc, ca] = [mid(a, b), mid(b, c), mid(c, a)]
    return [[a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]]
  })
}

const FACES = rockFaces()

// A rock's corner: pushed in or out by its own numbers (the same corner the same in every face).
function corner(v: V3, seed: number): V3 {
  const key = Math.round(v[0] * 1000) * 73856093 ^ Math.round(v[1] * 1000) * 19349663 ^ Math.round(v[2] * 1000) * 83492791
  const bump = 0.72 + random(seed ^ key)() * 0.5
  return [v[0] * bump, v[1] * bump * 0.8, v[2] * bump]
}

export interface BoulderGround {
  latitude: number
  longitude: number
  radiusKm: number
  // The ground's height there (m over the site's level), and the tile's bounds for the photo's uv.
  heightAt: (east: number, north: number) => number | null
  bounds: { north: number; south: number; west: number; east: number }
}

// The site's own axes in the Moon's: east, north, up.
function siteAxes(ground: BoulderGround): { east: V3; north: V3; up: V3 } {
  const [la, lo] = [ground.latitude * DEG, ground.longitude * DEG]
  const up: V3 = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)]
  const east: V3 = [-Math.sin(lo), Math.cos(lo), 0]
  return { east, north: [up[1] * east[2] - up[2] * east[1], up[2] * east[0] - up[0] * east[2], up[0] * east[1] - up[1] * east[0]], up }
}

// Where on the ground's photo a place (m east and north of the site) is.
function photoUv(ground: BoulderGround, east: number, north: number): [number, number] {
  const radius = ground.radiusKm * 1000
  const longitude = ground.longitude + east / (radius * Math.cos(ground.latitude * DEG)) / DEG
  const latitude = ground.latitude + north / radius / DEG
  const { bounds } = ground
  return [(longitude - bounds.west) / (bounds.east - bounds.west), (bounds.north - latitude) / (bounds.north - bounds.south)]
}

// One boulder's facets (place, normal, uv, assembly per corner), or none off the ground.
function boulderFacets(boulder: Boulder, ground: BoulderGround, axes: { east: V3; north: V3; up: V3 }): number[] {
  const height = ground.heightAt(boulder.east, boulder.north)
  if (height === null) return []
  const uv = photoUv(ground, boulder.east, boulder.north)
  const [c, s] = [Math.cos(boulder.turn), Math.sin(boulder.turn)]
  // A rock's point (its own frame: x east, y up, z south - right-handed, so its facets face out).
  const place = (v: V3): number[] => {
    const [x, y, z] = [(v[0] * c - v[2] * s) * boulder.size, v[1] * boulder.size, (v[0] * s + v[2] * c) * boulder.size]
    const [e, n, h] = [boulder.east + x, boulder.north - z, height + y - boulder.size * 0.18]
    return [0, 1, 2].map((k) => axes.east[k] * e + axes.north[k] * n + axes.up[k] * h)
  }
  return FACES.flatMap((face) => {
    const [a, b, d] = face.map((v) => place(corner(v, boulder.seed)))
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
    const w = [d[0] - a[0], d[1] - a[1], d[2] - a[2]]
    const normal = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]
    const length = Math.hypot(normal[0], normal[1], normal[2]) || 1
    return [a, b, d].flatMap((p) => [p[0], p[1], p[2], normal[0] / length, normal[1] / length, normal[2] / length, uv[0], uv[1], 0])
  })
}

// The boulders as more of a model (the terrain): their facets added after its own, drawn with the
// same photo - so they cast their shadows on it, in its own shadow map.
export function withBoulders(model: ModelData, boulders: readonly Boulder[], ground: BoulderGround): ModelData {
  const axes = siteAxes(ground)
  const extra = Float32Array.from(boulders.flatMap((boulder) => boulderFacets(boulder, ground, axes)))
  const [base, count] = [model.description.vertexCount, extra.length / 9]
  const vertices = new Float32Array(model.vertices.length + extra.length)
  vertices.set(model.vertices)
  vertices.set(extra, model.vertices.length)
  const indices = new Uint32Array(model.indices.length + count)
  indices.set(model.indices)
  for (let i = 0; i < count; i++) indices[model.indices.length + i] = base + i
  const draws = [{ ...model.description.draws[0], indexCount: indices.length }]
  return { description: { ...model.description, vertexCount: base + count, indexCount: indices.length, draws }, vertices, indices }
}

export function bouldersModel(boulders: readonly Boulder[], ground: BoulderGround, texture = 'tranquility-albedo.jpg'): ModelData {
  const axes = siteAxes(ground)
  const vertices = boulders.flatMap((boulder) => boulderFacets(boulder, ground, axes))
  const count = vertices.length / 9
  const extent = 600
  return {
    description: { vertexCount: count, indexCount: count, indexFormat: 'uint32', assemblies: [{ id: 'rocks', explode: [0, 0, 0] }], draws: [{ texture, firstIndex: 0, indexCount: count }], anchors: {}, bounds: { min: [-extent, -extent, -extent], max: [extent, extent, extent] } },
    vertices: new Float32Array(vertices),
    indices: Uint32Array.from({ length: count }, (_, i) => i),
  }
}
