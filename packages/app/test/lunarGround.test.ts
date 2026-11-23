import { describe, expect, it } from 'vitest'
import { lunarGround } from '../src/missions/apollo11/lunarGround'

describe('the ground round Tranquility Base', () => {
  const ground = lunarGround({ latitude: 0.67416, longitude: 23.47314, radiusKm: 1735.47 })

  it('starts at the site and curves away with the Moon', () => {
    const v = ground.vertices
    expect(Math.hypot(v[0], v[1], v[2])).toBe(0)
    const last = (ground.description.vertexCount - 1) * 9
    const outward = [Math.cos(0.67416 * Math.PI / 180) * Math.cos(23.47314 * Math.PI / 180), Math.cos(0.67416 * Math.PI / 180) * Math.sin(23.47314 * Math.PI / 180), Math.sin(0.67416 * Math.PI / 180)]
    const drop = v[last] * outward[0] + v[last + 1] * outward[1] + v[last + 2] * outward[2]
    // 45 km out the ground has dropped some 600 m below the site's level.
    expect(drop).toBeLessThan(-400)
  })

  it("maps the Moon's picture where the Moon has it", () => {
    expect(ground.vertices[6]).toBeCloseTo(0.5 + 23.47314 / 360, 6)
    expect(ground.vertices[7]).toBeCloseTo(0.5 - 0.67416 / 180, 6)
  })
})

describe("the ground's triangles", () => {
  it('face up: wound counter-clockwise seen from above, as the model pipeline takes the front', () => {
    const ground = lunarGround({ latitude: 0.67416, longitude: 23.47314, radiusKm: 1735.47 })
    const v = ground.vertices
    const at = (i: number) => [v[i * 9], v[i * 9 + 1], v[i * 9 + 2]]
    // A triangle out on the second ring (not the degenerate first).
    const [a, b, c] = [...ground.indices.slice(6 * 96 * 2, 6 * 96 * 2 + 3)].map(at)
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
    const w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]
    const up = [v[0 * 9 + 3], v[4], v[5]]
    expect(n[0] * up[0] + n[1] * up[1] + n[2] * up[2]).toBeGreaterThan(0)
  })
})
