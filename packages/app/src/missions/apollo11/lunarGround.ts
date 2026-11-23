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

export function lunarGround(site: Site, texture = 'moon.jpg'): ModelData {
  const centre = point(site, 0, 0).position
  const vertices: number[] = []
  const indices: number[] = []
  for (let ring = 0; ring <= RINGS; ring++) {
    const angle = ring === 0 ? 0 : INNERMOST_RADIANS * (REACH_RADIANS / INNERMOST_RADIANS) ** ((ring - 1) / (RINGS - 1))
    for (let k = 0; k <= SEGMENTS; k++) {
      const { position, lat, lon } = point(site, angle, (k / SEGMENTS) * 2 * Math.PI)
      const length = Math.hypot(position[0], position[1], position[2])
      vertices.push(position[0] - centre[0], position[1] - centre[1], position[2] - centre[2], position[0] / length, position[1] / length, position[2] / length, 0.5 + lon / (2 * Math.PI), 0.5 - lat / Math.PI, 0)
    }
  }
  for (let ring = 0; ring < RINGS; ring++) {
    for (let k = 0; k < SEGMENTS; k++) {
      const [a, b] = [ring * (SEGMENTS + 1) + k, (ring + 1) * (SEGMENTS + 1) + k]
      indices.push(a, b, a + 1, a + 1, b, b + 1)
    }
  }
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
