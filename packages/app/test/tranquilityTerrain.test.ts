import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { terrainHeight, tranquilityTerrain, type TerrainTile } from '../src/missions/apollo11/tranquilityTerrain'

const dir = new URL('../public/data/apollo11/terrain/', import.meta.url)
const tile = JSON.parse(readFileSync(new URL('tranquility.json', dir), 'utf8')) as TerrainTile
const bytes = readFileSync(new URL('tranquility-heights.bin', dir))
const raw = new Uint16Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
const terrain = tranquilityTerrain(tile, raw, { latitude: 0.67416, longitude: 23.47314, radiusKm: 1735.5 })
const v = terrain.vertices
const up = (() => {
  const [la, lo] = [(0.67416 * Math.PI) / 180, (23.47314 * Math.PI) / 180]
  return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)]
})()
const heightOf = (i: number) => v[i * 9] * up[0] + v[i * 9 + 1] * up[1] + v[i * 9 + 2] * up[2]

describe("Tranquility Base's terrain", () => {
  it('puts the site on Eagle’s ground: the grid point nearest it within a metre of level', () => {
    let nearest = 0
    let best = Infinity
    for (let i = 0; i < terrain.description.vertexCount; i++) {
      const d = Math.hypot(v[i * 9], v[i * 9 + 1], v[i * 9 + 2])
      if (d < best) [best, nearest] = [d, i]
    }
    expect(best).toBeLessThan(6)
    expect(Math.abs(heightOf(nearest))).toBeLessThan(1)
  })

  it('has relief: craters some metres deep near the site', () => {
    const heights = Array.from({ length: terrain.description.vertexCount }, (_, i) => heightOf(i)).filter((_, i) => Math.hypot(v[i * 9], v[i * 9 + 1], v[i * 9 + 2]) < 800)
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(8)
  })

  it('sinks under the cap at its corners', () => {
    // The north-west corner: the first vertex. Curvature 3 km out drops ~2.6 m; sunk below that.
    const corner = heightOf(0) + Math.hypot(v[0], v[1], v[2]) ** 2 / (2 * 1735500)
    expect(corner).toBeLessThan(0)
  })

  it('faces up', () => {
    const middle = Math.floor(terrain.description.vertexCount / 2)
    const n = [v[middle * 9 + 3], v[middle * 9 + 4], v[middle * 9 + 5]]
    expect(n[0] * up[0] + n[1] * up[1] + n[2] * up[2]).toBeGreaterThan(0.9)
  })
})

describe("the terrain's height for a camera on it", () => {
  const height = terrainHeight(tile, raw, { latitude: 0.67416, longitude: 23.47314, radiusKm: 1735.5 })
  it('is level at the site and has relief round it, none off the tile', () => {
    expect(Math.abs(height(0, 0)!)).toBeLessThan(0.5)
    const around = [-300, -150, 150, 300].flatMap((e) => [-300, 150, 300].map((n) => height(e, n)!))
    expect(Math.max(...around) - Math.min(...around)).toBeGreaterThan(1)
    expect(height(5000, 0)).toBeNull()
  })
})
