import { describe, expect, it } from 'vitest'
import { bouldersModel } from '../src/missions/apollo11/boulders'

describe("Tranquility Base's boulders", () => {
  const ground = { latitude: 0.674, longitude: 23.473, radiusKm: 1735.5, heightAt: () => 0, bounds: { north: 0.74, south: 0.61, west: 23.37, east: 23.51 } }

  it('makes each boulder a closed rock of 80 facets, sitting on the ground, a little sunk', () => {
    const model = bouldersModel([{ east: 50, north: 20, size: 1, seed: 7, turn: 0.3 }], ground)
    expect(model.description.vertexCount).toBe(240)
    const v = model.vertices
    const la = (0.674 * Math.PI) / 180
    const lo = (23.473 * Math.PI) / 180
    const up = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)]
    const heights = Array.from({ length: 240 }, (_, i) => v[i * 9] * up[0] + v[i * 9 + 1] * up[1] + v[i * 9 + 2] * up[2])
    expect(Math.min(...heights)).toBeLessThan(0)
    expect(Math.max(...heights)).toBeGreaterThan(0.2)
    expect(Math.max(...heights)).toBeLessThan(1)
  })

  it('turns its facets outward', () => {
    const model = bouldersModel([{ east: 0, north: 40, size: 2, seed: 3, turn: 0 }], ground)
    const v = model.vertices
    let outward = 0
    for (let f = 0; f < 80; f++) {
      const i = f * 27
      const centre = [0, 1, 2].map((k) => (v[i + k] + v[i + 9 + k] + v[i + 18 + k]) / 3)
      const middle = [0, 1, 2].map((k) => Array.from({ length: 240 }, (_, j) => v[j * 9 + k]).reduce((a, b) => a + b) / 240)
      const n = [v[i + 3], v[i + 4], v[i + 5]]
      if ((centre[0] - middle[0]) * n[0] + (centre[1] - middle[1]) * n[1] + (centre[2] - middle[2]) * n[2] > 0) outward++
    }
    expect(outward).toBeGreaterThan(70)
  })
})
