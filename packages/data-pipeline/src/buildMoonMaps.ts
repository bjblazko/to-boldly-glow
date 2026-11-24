import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { regionPixels, REGION } from './apollo/moonMaps'

// The Moon's maps from NASA's Scientific Visualization Studio CGI Moon Kit (svs.gsfc.nasa.gov/4720;
// LROC WAC colour, LOLA heights; NASA media, not under copyright in the US - credit "NASA's
// Scientific Visualization Studio"), downloaded once into cache/moon-kit (not committed):
// - textures/moon.jpg: the whole Moon at 8192 x 4096 (some 1.3 km a pixel);
// - textures/moon_bump.jpg: its heights (LOLA, 16 pixels a degree) for the body shader's relief;
// - data/apollo11/moon-region.jpg and moon-region-heights.bin (+ .json): the region round
//   Tranquility Base the tour flies over, its colour at some 400 m a pixel and its heights every
//   ~3.8 km, for the near view of the Moon from lunar orbit.

const HERE = dirname(fileURLToPath(import.meta.url))
const CACHE = join(HERE, '../cache/moon-kit')
const APP = join(HERE, '../../app/public')
sharp.cache(false)

async function globalMaps(): Promise<void> {
  await sharp(join(CACHE, 'lroc_color_poles_8k.tif'), { limitInputPixels: false }).greyscale().jpeg({ quality: 82, mozjpeg: true }).toFile(join(APP, 'textures/moon.jpg'))
  // The heights stretched over 8 bits (the shader wants relief, not metres).
  await sharp(join(CACHE, 'ldem_16_uint.tif'), { limitInputPixels: false }).resize(4096, 2048).normalise().toColourspace('b-w').jpeg({ quality: 90 }).toFile(join(APP, 'textures/moon_bump.jpg'))
}

async function regionMaps(): Promise<void> {
  const out = join(APP, 'data/apollo11')
  mkdirSync(out, { recursive: true })
  const colour = regionPixels(27360, 13680)
  await sharp(join(CACHE, 'lroc_color_poles.tif'), { limitInputPixels: false }).extract(colour).greyscale().jpeg({ quality: 84, mozjpeg: true }).toFile(join(out, 'moon-region.jpg'))
  // Heights: 64 pixels a degree, every 8th (some 3.8 km), uint16 half-metres over 1727.4 km.
  const heights = regionPixels(23040, 11520)
  const step = 8
  const { data, info } = await sharp(join(CACHE, 'ldem_64_uint.tif'), { limitInputPixels: false }).extract(heights).resize(Math.round(heights.width / step), Math.round(heights.height / step), { kernel: 'cubic' }).raw({ depth: 'ushort' }).toBuffer({ resolveWithObject: true })
  writeFileSync(join(out, 'moon-region-heights.bin'), data)
  const description = {
    source: "NASA's Scientific Visualization Studio, CGI Moon Kit (svs.gsfc.nasa.gov/4720): LROC WAC colour, LOLA heights",
    bounds: REGION,
    colour: { file: 'moon-region.jpg', width: colour.width, height: colour.height },
    heights: { file: 'moon-region-heights.bin', width: info.width, height: info.height, format: 'uint16 little-endian; km from the Moon centre = 1727.4 + value / 2000' },
  }
  writeFileSync(join(out, 'moon-region.json'), `${JSON.stringify(description, null, 2)}\n`)
  console.log(`region: colour ${colour.width} x ${colour.height}, heights ${info.width} x ${info.height}`)
}

await globalMaps()
await regionMaps()
console.log('Moon maps written')
