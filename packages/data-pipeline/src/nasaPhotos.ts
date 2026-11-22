import { mkdirSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'

// Downloads photos from NASA's Image and Video Library by their NASA id and resizes them for the
// lesson panel. Each one's caption is checked by hand for a credit other than NASA's before it is
// listed (docs/asset-sources.md); each is credited in CREDITS.md and the app's credits. A file with a
// harmless flaw (a stray byte before a JPEG marker, as some of KSC's scans have) is read anyway.

const MAX_SIDE = 1200
const JPEG = { quality: 82, mozjpeg: true }

async function original(nasaId: string): Promise<Buffer> {
  const response = await fetch(`https://images-assets.nasa.gov/image/${nasaId}/${nasaId}~orig.jpg`)
  if (!response.ok) throw new Error(`${nasaId}: ${response.status}`)
  return Buffer.from(await response.arrayBuffer())
}

export async function fetchNasaPhotos(nasaIds: readonly string[], out: string): Promise<void> {
  mkdirSync(out, { recursive: true })
  for (const nasaId of nasaIds) {
    const photo = await sharp(await original(nasaId), { failOn: 'none' }).resize(MAX_SIDE, MAX_SIDE, { fit: 'inside', withoutEnlargement: true }).jpeg(JPEG).toBuffer()
    writeFileSync(`${out}/${nasaId}.jpg`, photo)
    console.log(`${nasaId}: ${photo.length} bytes`)
  }
}
