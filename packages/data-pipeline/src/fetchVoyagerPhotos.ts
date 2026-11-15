import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

// Downloads the Voyager lessons' photos from NASA's Image and Video Library (all NASA/JPL, public
// domain - each one's credit is in CREDITS.md and the app's credits) and resizes them for the
// lesson panel. `npm run fetch-voyager-photos`; the output is committed.
export const VOYAGER_PHOTOS = ['PIA21747', 'PIA21744', 'PIA01384', 'PIA00379', 'PIA00459', 'PIA01383', 'PIA00024', 'PIA01486', 'PIA18182', 'PIA00042', 'PIA01492', 'PIA02246', 'PIA23645'] as const

const MAX_SIDE = 1200
const JPEG = { quality: 82, mozjpeg: true }

async function original(nasaId: string): Promise<Buffer> {
  const response = await fetch(`https://images-assets.nasa.gov/image/${nasaId}/${nasaId}~orig.jpg`)
  if (!response.ok) throw new Error(`${nasaId}: ${response.status}`)
  return Buffer.from(await response.arrayBuffer())
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = join(dirname(fileURLToPath(import.meta.url)), '../../app/public/images/voyager')
  mkdirSync(out, { recursive: true })
  for (const nasaId of VOYAGER_PHOTOS) {
    const photo = await sharp(await original(nasaId)).resize(MAX_SIDE, MAX_SIDE, { fit: 'inside', withoutEnlargement: true }).jpeg(JPEG).toBuffer()
    writeFileSync(join(out, `${nasaId}.jpg`), photo)
    console.log(`${nasaId}: ${photo.length} bytes`)
  }
}
