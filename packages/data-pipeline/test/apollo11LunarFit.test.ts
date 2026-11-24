import { beforeAll, describe, expect, it } from 'vitest'
import { eagleAtPdi, landingGeometry, PDI_RANGE_DEGREES } from '../src/apollo/trajectory/apollo11LunarFit'
import { grailField, type GravityField } from '../src/apollo/trajectory/lunarGravity'

describe("Columbia's orbit over the landing site", () => {
  let field: GravityField
  beforeAll(async () => {
    field = await grailField(60)
  }, 60_000)

  it('runs over Tranquility Base: the site in Eagle’s orbit plane at the landing, about 300 miles ahead at powered descent', () => {
    const { crossTrack, range } = landingGeometry(eagleAtPdi(field))
    expect(Math.abs(crossTrack)).toBeLessThan(0.05)
    expect(Math.abs(range - PDI_RANGE_DEGREES)).toBeLessThan(0.1)
  }, 120_000)
})
