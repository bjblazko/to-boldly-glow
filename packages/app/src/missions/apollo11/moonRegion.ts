import type { ModelData } from '../../spacecraft/modelFile'

// The region of the Moon the tour flies over low (round Tranquility Base, from the limb Columbia
// comes round on to well past the site): LOLA's heights every ~3.8 km under LROC's colour at some
// 400 m a pixel (NASA SVS CGI Moon Kit; the data pipeline's build-moon-maps), so mountains and
// large craters stand out on the horizon. Built in metres in the Moon's own axes, from the point at
// the region's middle on the mean sphere; drawn with the Moon in the world's pass at its true
// heights - the tour draws the Moon's sphere a few kilometres small, under the maria (apollo11Scene),
// so the two never fight and the region meets the ground at the site.

export interface RegionDescription {
  bounds: { west: number; east: number; south: number; north: number }
  heights: { width: number; height: number }
}

const DEG = Math.PI / 180
const MEAN_RADIUS_M = 1_737_400

function direction(latitude: number, longitude: number): [number, number, number] {
  const [la, lo] = [latitude * DEG, longitude * DEG]
  return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)]
}

export function regionMiddle({ bounds }: RegionDescription): [number, number, number] {
  return direction((bounds.north + bounds.south) / 2, (bounds.west + bounds.east) / 2).map((v) => v * MEAN_RADIUS_M) as [number, number, number]
}

type Hole = { latitude: number; longitude: number; radius: number }

// The grid's points (place from the region's middle, normal, uv, assembly) and which lie in the hole.
function regionVertices(region: RegionDescription, raw: Uint16Array, hole: Hole): { vertices: Float32Array; inside: boolean[] } {
  const { bounds, heights } = region
  const [columns, rows] = [heights.width, heights.height]
  const middle = regionMiddle(region)
  const holeDirection = direction(hole.latitude, hole.longitude)
  const vertices = new Float32Array(columns * rows * 9)
  const inside: boolean[] = []
  for (let i = 0; i < columns * rows; i++) {
    const [u, v] = [(i % columns) / (columns - 1), Math.floor(i / columns) / (rows - 1)]
    const d = direction(bounds.north + (bounds.south - bounds.north) * v, bounds.west + (bounds.east - bounds.west) * u)
    const r = 1_727_400 + raw[i] * 0.5
    vertices.set([d[0] * r - middle[0], d[1] * r - middle[1], d[2] * r - middle[2], d[0], d[1], d[2], u, v, 0], i * 9)
    inside.push(MEAN_RADIUS_M * Math.acos(Math.min(1, d[0] * holeDirection[0] + d[1] * holeDirection[1] + d[2] * holeDirection[2])) < hole.radius)
  }
  smoothNormals(vertices, columns, rows)
  return { vertices, inside }
}

// Rows run south, columns east: wound counter-clockwise seen from above; cells in the hole left out.
function regionIndices(inside: boolean[], columns: number, rows: number): Uint32Array {
  const indices: number[] = []
  for (let row = 0; row < rows - 1; row++) {
    for (let column = 0; column < columns - 1; column++) {
      const a = row * columns + column
      if ([a, a + 1, a + columns, a + columns + 1].some((k) => inside[k])) continue
      indices.push(a, a + columns, a + 1, a + 1, a + columns, a + columns + 1)
    }
  }
  return new Uint32Array(indices)
}

// `raw`: uint16 half-metres over 1727.4 km, rows north to south. `hole`: the site and how far round it
// (m) the cap covers - cells there are left out.
export function moonRegion(region: RegionDescription, raw: Uint16Array, hole: Hole): ModelData {
  const { vertices, inside } = regionVertices(region, raw, hole)
  const indices = regionIndices(inside, region.heights.width, region.heights.height)
  const extent = 2_500_000
  return {
    description: { vertexCount: vertices.length / 9, indexCount: indices.length, indexFormat: 'uint32', assemblies: [{ id: 'region', explode: [0, 0, 0] }], draws: [{ texture: 'moon-region.jpg', firstIndex: 0, indexCount: indices.length }], anchors: {}, bounds: { min: [-extent, -extent, -extent], max: [extent, extent, extent] } },
    vertices,
    indices,
  }
}

// Each point's normal from its neighbours' places (east-west across north-south).
function smoothNormals(vertices: Float32Array, columns: number, rows: number): void {
  const at = (row: number, column: number) => {
    const i = (Math.min(rows - 1, Math.max(0, row)) * columns + Math.min(columns - 1, Math.max(0, column))) * 9
    return [vertices[i], vertices[i + 1], vertices[i + 2]]
  }
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const [e, w, s, n] = [at(row, column + 1), at(row, column - 1), at(row + 1, column), at(row - 1, column)]
      const east = [e[0] - w[0], e[1] - w[1], e[2] - w[2]]
      const north = [n[0] - s[0], n[1] - s[1], n[2] - s[2]]
      const normal = [east[1] * north[2] - east[2] * north[1], east[2] * north[0] - east[0] * north[2], east[0] * north[1] - east[1] * north[0]]
      const length = Math.hypot(normal[0], normal[1], normal[2]) || 1
      vertices.set([normal[0] / length, normal[1] / length, normal[2] / length], (row * columns + column) * 9 + 3)
    }
  }
}
