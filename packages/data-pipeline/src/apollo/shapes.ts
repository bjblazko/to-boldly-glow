import type { MeshPrimitive } from '../spacecraft/glbMesh'
import { latheMesh, type LatheOptions, type ProfilePoint } from './latheMesh'
import type { Tank } from './saturnVProfile'

type Point = readonly [number, number, number]

// A flat four-cornered plate (a fin), corners in order around it; the renderer draws both faces.
export function plateMesh(corners: readonly [Point, Point, Point, Point], texture: string, uv: [number, number]): MeshPrimitive {
  const normal = plateNormal(corners)
  return {
    texture,
    positions: Float32Array.from(corners.flat()),
    normals: Float32Array.from(corners.flatMap(() => normal)),
    uvs: Float32Array.from(corners.flatMap(() => uv)),
    indices: Uint32Array.from([0, 1, 2, 0, 2, 3]),
  }
}

function plateNormal([a, b, , d]: readonly Point[]): number[] {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
  const v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]]
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
  const length = Math.hypot(n[0], n[1], n[2]) || 1
  return n.map((value) => value / length)
}

export interface RodLook {
  radius: number
  texture: string
  uv: [number, number]
  sides?: number
}

// A thin round rod from one point to another (a strut of the escape tower).
export function strutMesh(from: Point, to: Point, { radius, texture, uv, sides = 6 }: RodLook): MeshPrimitive {
  const frame = segmentFrame(from, to)
  const rod = latheMesh([[radius, 0], [radius, frame.length]], { texture, uv: () => uv, segments: sides })
  return { ...rod, positions: turned(rod.positions, frame, from), normals: turned(rod.normals, frame, [0, 0, 0]) }
}

// Axes that turn +Y onto the segment from `from` to `to`, and its length.
interface SegmentFrame {
  side: number[]
  axis: number[]
  third: number[]
  length: number
}

function segmentFrame(from: Point, to: Point): SegmentFrame {
  const delta = [to[0] - from[0], to[1] - from[1], to[2] - from[2]]
  const length = Math.hypot(delta[0], delta[1], delta[2])
  const axis = delta.map((value) => value / length)
  const side = Math.abs(axis[1]) < 0.99 ? normalize(cross(axis, [0, 1, 0])) : [1, 0, 0]
  return { side, axis, third: cross(side, axis), length }
}

// Vectors made along +Y, turned onto the segment and moved to `origin`.
function turned(values: Float32Array, { side, axis, third }: SegmentFrame, origin: Point): Float32Array {
  const result = new Float32Array(values.length)
  for (let offset = 0; offset < values.length; offset += 3) {
    const [x, y, z] = [values[offset], values[offset + 1], values[offset + 2]]
    for (let k = 0; k < 3; k++) result[offset + k] = side[k] * x + axis[k] * y + third[k] * z + origin[k]
  }
  return result
}

function cross(a: number[], b: number[]): number[] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

function normalize(v: number[]): number[] {
  const length = Math.hypot(v[0], v[1], v[2])
  return v.map((value) => value / length)
}

const DOME_STEPS = 8

// A tank's profile from the bottom of its lower dome up: domes as half ellipses. A negative dome
// depth bulges into the tank (a common bulkhead shared with the tank below).
export function tankProfile({ radius, bottom, top, lowerDome, upperDome }: Tank): ProfilePoint[] {
  const lower = domePoints(radius, bottom, -lowerDome).reverse()
  const upper = domePoints(radius, top, upperDome)
  return [...lower, ...upper]
}

// From the rim (at `height`) to the axis, `depth` above (or, negative, below) the rim.
function domePoints(radius: number, height: number, depth: number): ProfilePoint[] {
  return Array.from({ length: DOME_STEPS + 1 }, (_, step) => {
    const angle = (step / DOME_STEPS) * (Math.PI / 2)
    return [radius * Math.cos(angle), height + depth * Math.sin(angle)] as ProfilePoint
  })
}

// An engine (or any profile measured from its bottom) standing at (x, z), its bottom at `base`.
export function placedLathe(profile: readonly ProfilePoint[], [x, z]: readonly [number, number], base: number, options: Omit<LatheOptions, 'axis'>): MeshPrimitive {
  return latheMesh(profile.map(([radius, height]) => [radius, base + height] as ProfilePoint), { ...options, axis: [x, z] })
}
