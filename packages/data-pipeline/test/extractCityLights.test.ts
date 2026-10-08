import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { cityLightLevel, extractCityLights } from '../src/extractCityLights'

// Colors measured on NASA's Black Marble 2012 picture (see extractCityLights.ts).
const BACKGROUND = { pacific: [0, 2, 29], sahara: [13, 28, 75], antarctica: [15, 31, 82], siberia: [3, 7, 39], kansasFarmland: [10, 16, 49] }
const CITIES = { paris: [255, 255, 227], newYork: [255, 250, 216], lagos: [192, 171, 125] }

describe('cityLightLevel', () => {
  it('leaves the picture’s blue land, ocean and ice dark', () => {
    for (const [red, , blue] of Object.values(BACKGROUND)) expect(cityLightLevel(red, blue)).toBe(0)
  })

  it('keeps the cities, brightest in the largest', () => {
    expect(cityLightLevel(CITIES.newYork[0], CITIES.newYork[2])).toBe(255)
    expect(cityLightLevel(CITIES.paris[0], CITIES.paris[2])).toBeGreaterThan(245)
    const lagos = cityLightLevel(CITIES.lagos[0], CITIES.lagos[2])
    expect(lagos).toBeGreaterThan(100)
    expect(lagos).toBeLessThan(255)
  })
})

describe('extractCityLights', () => {
  it('turns the picture into a one-channel map of the lights, the same size', async () => {
    const pixels = Buffer.from([...BACKGROUND.sahara, ...CITIES.paris, ...BACKGROUND.pacific, ...CITIES.lagos])
    const input = await sharp(pixels, { raw: { width: 2, height: 2, channels: 3 } }).png().toBuffer()
    const output = await extractCityLights(input)
    const metadata = await sharp(output).metadata()
    expect([metadata.width, metadata.height, metadata.channels]).toEqual([2, 2, 1])
    const { data } = await sharp(output).extractChannel(0).raw().toBuffer({ resolveWithObject: true })
    expect([...data]).toEqual([0, cityLightLevel(CITIES.paris[0], CITIES.paris[2]), 0, cityLightLevel(CITIES.lagos[0], CITIES.lagos[2])])
  })
})
