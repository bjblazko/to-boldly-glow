import { describe, expect, it } from 'vitest'
import { bounceFrom, EARTH_LIGHT, MOON_LIGHT } from '../src/missions/apollo11/spaceLight'

describe('the light a body throws back onto a craft', () => {
  const toSun: [number, number, number] = [1, 0, 0]
  const moon = { ...MOON_LIGHT, centreKm: [0, 0, 0] as [number, number, number] }

  it('is strongest over the day side, none over the night side', () => {
    const overDay = bounceFrom([1850, 0, 0], [moon], toSun)!
    const overNight = bounceFrom([-1850, 0, 0], [moon], toSun)!
    expect(overDay.strength).toBeGreaterThan(0.1)
    expect(overNight.strength).toBeCloseTo(0, 6)
    expect(overDay.direction[0]).toBeCloseTo(-1, 6)
  })

  it("is Earth's near Earth and the Moon's near the Moon", () => {
    const earth = { ...EARTH_LIGHT, centreKm: [0, 0, 0] as [number, number, number] }
    const farMoon = { ...MOON_LIGHT, centreKm: [384_000, 0, 0] as [number, number, number] }
    expect(bounceFrom([0, 6600, 0], [earth, farMoon], toSun)!.color).toEqual(EARTH_LIGHT.color)
    expect(bounceFrom([384_000, 1850, 0], [earth, farMoon], toSun)!.color).toEqual(MOON_LIGHT.color)
  })
})
