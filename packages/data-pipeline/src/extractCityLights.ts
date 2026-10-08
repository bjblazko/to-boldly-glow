import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

// Pulls the city lights out of NASA's "Earth at Night" (Black Marble 2012) image, for the lights on
// Earth's night side. That picture is a composite: the lights over a dim blue rendering of land,
// ocean and ice. The background is blue (red only a fifth of blue at most, measured on the
// picture's ice, desert and ocean), the lights are yellow-white - so taking away a fifth of the
// blue channel from the red one leaves the lights alone. The level stays sRGB-encoded, so the app
// decodes it to linear light when it samples the texture.
//
// Source: build/dist/images/dnb_land_ocean_ice_2012.png in NASA WorldWind's npm package
// (@nasaworldwind/worldwind 0.11.1), the 2048x1024 version of NASA Earth Observatory's image by
// Robert Simmon, from Suomi NPP VIIRS data (Chris Elvidge, NOAA National Geophysical Data Center).
// NASA imagery, public domain. See CREDITS.md.
const BACKGROUND_RED_PER_BLUE = 0.22
// Leftover glow of the background's brightest parts (ice, deserts) after the subtraction.
const BACKGROUND_FLOOR = 4
// The level of the brightest city centers (255, 250, 216 in the source), mapped to full white.
const BRIGHTEST_LEVEL = 255 - BACKGROUND_RED_PER_BLUE * 216 - BACKGROUND_FLOOR

export function cityLightLevel(red: number, blue: number): number {
  const level = (red - BACKGROUND_RED_PER_BLUE * blue - BACKGROUND_FLOOR) / BRIGHTEST_LEVEL
  return Math.round(255 * Math.min(1, Math.max(0, level)))
}

export async function extractCityLights(input: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const lights = Buffer.alloc(info.width * info.height)
  for (let pixel = 0; pixel < lights.length; pixel++) lights[pixel] = cityLightLevel(data[pixel * 3], data[pixel * 3 + 2])
  return sharp(lights, { raw: { width: info.width, height: info.height, channels: 1 } })
    .toColourspace('b-w')
    .png({ compressionLevel: 9 })
    .toBuffer()
}

// `npm run extract-city-lights -- <path to dnb_land_ocean_ice_2012.png>`
if (import.meta.url === `file://${process.argv[1]}`) {
  const here = dirname(fileURLToPath(import.meta.url))
  const inputPath = process.argv[2]
  if (!inputPath) throw new Error('usage: extract-city-lights <path to dnb_land_ocean_ice_2012.png>')
  const outputPath = join(here, '../../app/public/textures/earth_night.png')
  writeFileSync(outputPath, await extractCityLights(readFileSync(inputPath)))
  console.log(`Wrote ${outputPath}`)
}
