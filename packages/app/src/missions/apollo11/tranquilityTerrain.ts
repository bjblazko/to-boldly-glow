import type { ModelData } from '../../spacecraft/modelFile'

// Tranquility Base's ground from LROC's terrain model (NAC_DTM_APOLLO11; the data pipeline's
// buildTranquility cut the tile and evened out its photo's shadows): a grid every 8 m over the 4 km
// tile, curved with the Moon, its photo (2 m) on it. In metres, in the Moon's own axes, from the site
// - as the ground cap round it (lunarGround.ts), which shows beyond it: the tile runs out to the
// cap's level at a circle round its middle and sinks just under the cap outside it.
//
// Heights are set so the site lies at the site's radius the trajectory has Eagle land on (the
// terrain model has it 27 m lower: the landing's reconstruction takes the site 2 km under the
// Moon's mean radius, APPROX; to be reconciled when the descent is fitted to the terrain).

export interface TerrainTile {
  bounds: { north: number; south: number; west: number; east: number }
  heights: { width: number; height: number; offset: number; scale: number }
  site: { latitude: number; longitude: number; heightMetres: number }
}

const DEG = Math.PI / 180
const STEP = 2
// Where the tile runs out to the cap's level (m from its middle), and how far below the cap it sinks
// beyond.
const BLEND_FROM = 1500
const BLEND_TO = 1950
const SUNK = 0.3

export function tileCircle(tile: TerrainTile): { latitude: number; longitude: number; radius: number } {
  const { north, south, west, east } = tile.bounds
  return { latitude: (north + south) / 2, longitude: (west + east) / 2, radius: BLEND_TO }
}

function direction(latitude: number, longitude: number): [number, number, number] {
  const [la, lo] = [latitude * DEG, longitude * DEG]
  return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)]
}

const smooth = (u: number) => {
  const t = Math.min(1, Math.max(0, u))
  return t * t * (3 - 2 * t)
}

type Ground = { latitude: number; longitude: number; radiusKm: number }

// One grid point (row and column in the heights): its place (m from the site) and its uv.
function gridPoint(tile: TerrainTile, raw: Uint16Array, ground: Ground, [row, column]: [number, number]): { position: number[]; uv: [number, number] } {
  const { bounds, heights, site } = tile
  const [u, v] = [column / (heights.width - 1), row / (heights.height - 1)]
  const d = direction(bounds.north + (bounds.south - bounds.north) * v, bounds.west + (bounds.east - bounds.west) * u)
  const middle = direction((bounds.north + bounds.south) / 2, (bounds.west + bounds.east) / 2)
  const radius = ground.radiusKm * 1000
  const fromMiddle = radius * Math.acos(Math.min(1, d[0] * middle[0] + d[1] * middle[1] + d[2] * middle[2]))
  const relief = heights.offset + raw[row * heights.width + column] * heights.scale - site.heightMetres
  const height = relief * (1 - smooth((fromMiddle - BLEND_FROM) / (BLEND_TO - BLEND_FROM))) - SUNK * smooth((fromMiddle - BLEND_TO) / 80)
  const centre = direction(ground.latitude, ground.longitude)
  return { position: [0, 1, 2].map((k) => d[k] * (radius + height) - centre[k] * radius), uv: [u, v] }
}

// `ground`: the site as the trajectory has Eagle stand on it (its place and its distance from the
// Moon's centre) - the frame's origin, as for the cap.
export function tranquilityTerrain(tile: TerrainTile, raw: Uint16Array, ground: Ground, texture = 'tranquility-albedo.jpg'): ModelData {
  const columns = Math.floor((tile.heights.width - 1) / STEP) + 1
  const rows = Math.floor((tile.heights.height - 1) / STEP) + 1
  const positions = new Float32Array(columns * rows * 3)
  const uvs = new Float32Array(columns * rows * 2)
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const { position, uv } = gridPoint(tile, raw, ground, [row * STEP, column * STEP])
      positions.set(position, (row * columns + column) * 3)
      uvs.set(uv, (row * columns + column) * 2)
    }
  }
  return gridModel(positions, uvs, { columns, rows }, texture)
}

function gridModel(positions: Float32Array, uvs: Float32Array, { columns, rows }: { columns: number; rows: number }, texture: string): ModelData {
  const normals = gridNormals(positions, columns, rows)
  const vertices = new Float32Array(columns * rows * 9)
  for (let i = 0; i < columns * rows; i++) vertices.set([positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2], normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2], uvs[i * 2], uvs[i * 2 + 1], 0], i * 9)
  const indices = new Uint32Array((columns - 1) * (rows - 1) * 6)
  let k = 0
  for (let row = 0; row < rows - 1; row++) {
    for (let column = 0; column < columns - 1; column++) {
      const a = row * columns + column
      // Rows run south, columns east: wound counter-clockwise seen from above.
      indices.set([a, a + columns, a + 1, a + 1, a + columns, a + columns + 1], k)
      k += 6
    }
  }
  const extent = 3000
  return {
    description: { vertexCount: columns * rows, indexCount: indices.length, indexFormat: 'uint32', assemblies: [{ id: 'ground', explode: [0, 0, 0] }], draws: [{ texture, firstIndex: 0, indexCount: indices.length }], anchors: {}, bounds: { min: [-extent, -extent, -extent], max: [extent, extent, extent] } },
    vertices,
    indices,
  }
}

// Each point's normal from its neighbours across the grid (one-sided at the edges).
function gridNormals(positions: Float32Array, columns: number, rows: number): Float32Array {
  const normals = new Float32Array(positions.length)
  const at = (row: number, column: number) => {
    const i = (Math.min(rows - 1, Math.max(0, row)) * columns + Math.min(columns - 1, Math.max(0, column))) * 3
    return [positions[i], positions[i + 1], positions[i + 2]]
  }
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const [e, w, s, n] = [at(row, column + 1), at(row, column - 1), at(row + 1, column), at(row - 1, column)]
      const east = [e[0] - w[0], e[1] - w[1], e[2] - w[2]]
      const north = [n[0] - s[0], n[1] - s[1], n[2] - s[2]]
      const normal = [east[1] * north[2] - east[2] * north[1], east[2] * north[0] - east[0] * north[2], east[0] * north[1] - east[1] * north[0]]
      const length = Math.hypot(normal[0], normal[1], normal[2]) || 1
      normals.set([normal[0] / length, normal[1] / length, normal[2] / length], (row * columns + column) * 3)
    }
  }
  return normals
}

// The terrain's height (m, over the site's level) a way east and north of the site - for a camera
// standing on it; null off the tile. Bilinear between the heights' grid points; level at the rim as
// the drawn terrain is.
export function terrainHeight(tile: TerrainTile, raw: Uint16Array, ground: Ground): (east: number, north: number) => number | null {
  const { bounds, heights, site } = tile
  const radius = ground.radiusKm * 1000
  return (east, north) => {
    const latitude = ground.latitude + (north / radius) / DEG
    const longitude = ground.longitude + (east / (radius * Math.cos(ground.latitude * DEG))) / DEG
    const x = ((longitude - bounds.west) / (bounds.east - bounds.west)) * (heights.width - 1)
    const y = ((bounds.north - latitude) / (bounds.north - bounds.south)) * (heights.height - 1)
    if (x < 0 || y < 0 || x > heights.width - 2 || y > heights.height - 2) return null
    const [x0, y0] = [Math.floor(x), Math.floor(y)]
    const value = (r: number, c: number) => heights.offset + raw[r * heights.width + c] * heights.scale
    const [fx, fy] = [x - x0, y - y0]
    const top = value(y0, x0) * (1 - fx) + value(y0, x0 + 1) * fx
    const bottom = value(y0 + 1, x0) * (1 - fx) + value(y0 + 1, x0 + 1) * fx
    return top * (1 - fy) + bottom * fy - site.heightMetres
  }
}
