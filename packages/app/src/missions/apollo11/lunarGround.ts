import type { ModelData } from '../../spacecraft/modelFile'

// The ground round Tranquility Base until its terrain comes (spec 2026-11-23): a cap of the Moon
// at the site's own radius, curved as the Moon is (so its horizon is where it was), its rings closer
// together near the site, and the Moon's map on it where the Moon has it. In metres, in the Moon's
// own axes (x: 0° E, y: 90° E, z: north), from the site.

const DEG = Math.PI / 180
// Out to 1.5 degrees (some 45 km): far past the horizon of a camera at a few hundred metres.
const RINGS = 48
const SEGMENTS = 96
const REACH_RADIANS = 1.5 * DEG
const INNERMOST_RADIANS = 0.00002

export interface Site {
  latitude: number
  longitude: number
  radiusKm: number
}

function point(site: Site, angle: number, bearing: number): { position: number[]; lat: number; lon: number } {
  // From the site, `angle` along the ground (radians) toward `bearing` (from north).
  const [la, lo] = [site.latitude * DEG, site.longitude * DEG]
  const lat = Math.asin(Math.sin(la) * Math.cos(angle) + Math.cos(la) * Math.sin(angle) * Math.cos(bearing))
  const lon = lo + Math.atan2(Math.sin(bearing) * Math.sin(angle) * Math.cos(la), Math.cos(angle) - Math.sin(la) * Math.sin(lat))
  const r = site.radiusKm * 1000
  return { position: [r * Math.cos(lat) * Math.cos(lon), r * Math.cos(lat) * Math.sin(lon), r * Math.sin(lat)], lat, lon }
}

type Hole = { latitude: number; longitude: number; radius: number }

// The ring's angle from the site (radians): crowded near it, out to the cap's reach.
const ringAngle = (ring: number) => (ring === 0 ? 0 : INNERMOST_RADIANS * (REACH_RADIANS / INNERMOST_RADIANS) ** ((ring - 1) / (RINGS - 1)))

// The cap's points (position from the site, normal, uv, assembly) and which fall in the hole.
function capVertices(site: Site, hole?: Hole): { vertices: number[]; inside: boolean[] } {
  const centre = point(site, 0, 0).position
  const holeDirection = hole ? point({ latitude: hole.latitude, longitude: hole.longitude, radiusKm: 0.001 }, 0, 0).position : null
  const vertices: number[] = []
  const inside: boolean[] = []
  for (let ring = 0; ring <= RINGS; ring++) {
    for (let k = 0; k <= SEGMENTS; k++) {
      const { position, lat, lon } = point(site, ringAngle(ring), (k / SEGMENTS) * 2 * Math.PI)
      const length = Math.hypot(position[0], position[1], position[2])
      vertices.push(position[0] - centre[0], position[1] - centre[1], position[2] - centre[2], position[0] / length, position[1] / length, position[2] / length, 0.5 + lon / (2 * Math.PI), 0.5 - lat / Math.PI, 0)
      const cosine = holeDirection ? (position[0] * holeDirection[0] + position[1] * holeDirection[1] + position[2] * holeDirection[2]) / length : -1
      inside.push(hole !== undefined && length * Math.acos(Math.min(1, cosine)) < hole.radius)
    }
  }
  return { vertices, inside }
}

// Wound so their front faces up (the shader turns a back face's normal round); a cell with any
// corner over the terrain left out.
function capIndices(inside: boolean[]): number[] {
  const indices: number[] = []
  for (let ring = 0; ring < RINGS; ring++) {
    for (let k = 0; k < SEGMENTS; k++) {
      const [a, b] = [ring * (SEGMENTS + 1) + k, (ring + 1) * (SEGMENTS + 1) + k]
      if (inside[a] || inside[a + 1] || inside[b] || inside[b + 1]) continue
      indices.push(a, a + 1, b, a + 1, b + 1, b)
    }
  }
  return indices
}

// `hole`: where the terrain lies - the cap leaves out what falls within it (its middle and radius, m).
export function lunarGround(site: Site, texture = 'moon.jpg', hole?: Hole): ModelData {
  const { vertices, inside } = capVertices(site, hole)
  const indices = capIndices(inside)
  const extent = site.radiusKm * 1000 * REACH_RADIANS
  return {
    description: {
      vertexCount: vertices.length / 9,
      indexCount: indices.length,
      indexFormat: 'uint32',
      assemblies: [{ id: 'ground', explode: [0, 0, 0] }],
      draws: [{ texture, firstIndex: 0, indexCount: indices.length }],
      anchors: {},
      bounds: { min: [-extent, -extent, -extent], max: [extent, extent, extent] },
    },
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
  }
}
