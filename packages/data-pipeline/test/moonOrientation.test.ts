import { describe, expect, it } from 'vitest'
import { moonAt, RANGE_ZERO_JD } from '../src/apollo/trajectory/apollo11Translunar'
import { moonBodyFixed } from '../src/apollo/trajectory/moonOrientation'

const DEG = 180 / Math.PI

describe("the Moon's orientation", () => {
  it('keeps its near side toward Earth through the mission, within its librations', () => {
    let [lonMax, latMax] = [0, 0]
    for (let get = 0; get <= 8 * 86400; get += 3 * 3600) {
      const toEarth = moonAt(get).map((value) => -value) as [number, number, number]
      const [x, y, z] = moonBodyFixed(RANGE_ZERO_JD + get / 86400, toEarth)
      const [lon, lat] = [Math.atan2(y, x) * DEG, Math.atan2(z, Math.hypot(x, y)) * DEG]
      lonMax = Math.max(lonMax, Math.abs(lon))
      latMax = Math.max(latMax, Math.abs(lat))
    }
    expect(lonMax).toBeLessThan(8.5)
    expect(latMax).toBeLessThan(7.5)
    // And it does librate: not stuck at 0, 0.
    expect(lonMax + latMax).toBeGreaterThan(2)
  })

  it('turns a vector without stretching it', () => {
    const v = moonBodyFixed(2440420, [3, -4, 12])
    expect(Math.hypot(...v)).toBeCloseTo(13, 9)
  })
})
