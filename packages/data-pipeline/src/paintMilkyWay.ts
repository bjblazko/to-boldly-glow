import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { galacticVector, type UnitVector } from './skyFrames'
import { DEEP_SKY_OBJECTS } from './milkyWay/deepSky'
import { objectLight, placeObject, type PlacedObject } from './milkyWay/deepSkyLight'
import { dustDepth, starlight, throughDust, type Rgb, type SkyNoise } from './milkyWay/galaxyLight'
import { createNoise, mulberry32 } from './milkyWay/noise'

// Paints the sky behind the stars - the Milky Way, its nebulae and dark clouds, and the nearest
// galaxies - into an equirectangular image in galactic coordinates: galactic longitude 0 (the
// galactic center) in the middle column, increasing to the right, latitude +90 at the top. The app
// draws it as the scene's backdrop (packages/app/src/sky/). Colors are worked out in display-space
// sRGB (the app's tone mapping leaves light this faint as it is) and stored as their square root:
// nearly all of the sky is within a few levels of black, where 8 bits - and JPEG's blocks - would
// otherwise show as steps. The app squares them back (see skyShader.ts).
//
// Painted rather than photographed: no all-sky photograph with a reuse license this project can
// ship was reachable, and a painting can stay subtle behind the planets. The star catalog
// provides the individual stars on top.

const NOISE_SEEDS = { clouds: 7, warp: 11, dust: 23, grain: 41 }

export function skyNoise(): SkyNoise {
  return {
    clouds: createNoise(NOISE_SEEDS.clouds),
    warp: createNoise(NOISE_SEEDS.warp),
    dust: createNoise(NOISE_SEEDS.dust),
    grain: createNoise(NOISE_SEEDS.grain),
  }
}

// The sky's color toward one galactic-frame direction.
export function skyColor(direction: UnitVector, objects: readonly PlacedObject[], noise: SkyNoise): Rgb {
  const behindDust: Rgb = starlight(direction, noise)
  const inFront: Rgb = [0, 0, 0]
  let depth = dustDepth(direction, noise)
  for (const placed of objects) {
    const light = objectLight(placed, direction, noise)
    if (!light) continue
    if (placed.object.kind === 'dark') depth += light[0]
    else addTo(placed.object.kind === 'starCloud' ? behindDust : inFront, light)
  }
  // Nebulae lie among the dust clouds rather than behind all of them.
  const dimmed = throughDust(inFront, depth * 0.35)
  return addTo(throughDust(behindDust, depth), dimmed)
}

export function paintSky(width: number, height: number): Uint8Array {
  const noise = skyNoise()
  const objects = DEEP_SKY_OBJECTS.map(placeObject)
  const dither = mulberry32(5)
  const pixels = new Uint8Array(width * height * 3)
  for (let row = 0; row < height; row++) {
    const latitude = 90 - ((row + 0.5) / height) * 180
    for (let column = 0; column < width; column++) {
      const longitude = ((column + 0.5) / width) * 360 - 180
      const color = skyColor(galacticVector(longitude, latitude), objects, noise)
      const offset = (row * width + column) * 3
      for (let channel = 0; channel < 3; channel++) pixels[offset + channel] = toByte(color[channel], dither())
    }
  }
  return pixels
}

export function toByte(value: number, dither: number): number {
  return Math.min(Math.max(Math.floor(Math.sqrt(Math.max(value, 0)) * 255 + dither), 0), 255)
}

function addTo(target: Rgb, light: Rgb): Rgb {
  target[0] += light[0]
  target[1] += light[1]
  target[2] += light[2]
  return target
}

// `npm run paint-sky [width]` (default 4096; the height is half of it).
if (import.meta.url === `file://${process.argv[1]}`) {
  const width = Number(process.argv[2] ?? 4096)
  const outputPath = join(dirname(fileURLToPath(import.meta.url)), '../../app/public/sky/milkyWay.jpg')
  const started = Date.now()
  const pixels = paintSky(width, width / 2)
  mkdirSync(dirname(outputPath), { recursive: true })
  await sharp(pixels, { raw: { width, height: width / 2, channels: 3 } }).jpeg({ quality: 90, mozjpeg: true }).toFile(outputPath)
  console.log(`Painted a ${width}x${width / 2} sky to ${outputPath} in ${((Date.now() - started) / 1000).toFixed(1)} s`)
}
