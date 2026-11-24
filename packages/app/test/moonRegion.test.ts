import { describe, expect, it } from 'vitest'
import { moonRegion } from '../src/missions/apollo11/moonRegion'

describe("the region of the Moon under the tour's lunar orbit", () => {
  const region = { bounds: { west: -10, east: 60, south: -10, north: 12 }, heights: { width: 71, height: 23 } }
  // Flat at the mean radius (1737.4 km = 1727.4 + 20000 half-metres).
  const raw = new Uint16Array(71 * 23).fill(20_000)
  const model = moonRegion(region, raw, { latitude: 0.674, longitude: 23.47, radius: 45_000 })

  it('lies at its true heights round the region’s middle, its normals up', () => {
    const v = model.vertices
    const i = (11 * 71 + 35) * 9
    const [x, y, z] = [v[i], v[i + 1], v[i + 2]]
    expect(Math.hypot(x, y, z)).toBeLessThan(1_000)
    const up = [v[i + 3], v[i + 4], v[i + 5]]
    expect(Math.hypot(...up)).toBeCloseTo(1, 6)
  })

  it('leaves out its cells round the site, where the ground cap lies', () => {
    const cells = 70 * 22 * 6
    expect(model.indices.length).toBeLessThan(cells)
    expect(model.indices.length).toBeGreaterThan(cells * 0.9)
  })

  it('faces up (wound counter-clockwise seen from above)', () => {
    const v = model.vertices
    const at = (k: number) => [v[k * 9], v[k * 9 + 1], v[k * 9 + 2]]
    const [a, b, c] = [...model.indices.slice(0, 3)].map(at)
    const n = [(b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])]
    const k = model.indices[0] * 9
    expect(n[0] * v[k + 3] + n[1] * v[k + 4] + n[2] * v[k + 5]).toBeGreaterThan(0)
  })
})
