import { mat4, vec4 } from 'gl-matrix'
import { describe, expect, it } from 'vitest'
import { CRAFT_DEPTH, squeezedProjection, sunlit } from '../src/missions/apollo11/craftPass'

const depthAt = (projection: mat4, metres: number) => {
  const clip = vec4.transformMat4(vec4.create(), [0, 0, -metres, 1], projection)
  return clip[2] / clip[3]
}

describe("the craft's metre pass", () => {
  it('puts everything from half a metre to 20 km in front of every body, in order', () => {
    const projection = squeezedProjection({ fov: 0.8, aspect: 1.6, near: 0.5, far: 20_000 })
    const depths = [0.5, 1, 10, 1000, 20_000].map((m) => depthAt(projection, m))
    expect(depths[0]).toBeCloseTo(0, 6)
    expect(depths.at(-1)).toBeCloseTo(CRAFT_DEPTH, 6)
    depths.slice(1).forEach((d, i) => expect(d).toBeGreaterThan(depths[i]))
  })

  it("darkens a craft in a body's shadow, with a soft edge", () => {
    const earth = { centreKm: [0, 0, 0] as [number, number, number], radiusKm: 6378 }
    const toSun: [number, number, number] = [1, 0, 0]
    expect(sunlit([-7000, 0, 0], [earth], toSun)).toBe(0)
    expect(sunlit([-7000, 0, 7000], [earth], toSun)).toBe(1)
    expect(sunlit([7000, 0, 0], [earth], toSun)).toBe(1)
    const edge = sunlit([-200_000, 0, 6378], [earth], toSun)
    expect(edge).toBeGreaterThan(0.1)
    expect(edge).toBeLessThan(0.9)
  })
})
