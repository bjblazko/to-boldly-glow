import sharp from 'sharp'

// The model's main texture is assembled from photos of the real spacecraft; one of them shows a
// sticker with NASA's "worm" logotype, which is not in the public domain (see docs/asset-sources.md).
// It is covered in the mean color of the plain surface right beside it. Pixel rectangles in the
// 1024x1024 texture.
const LOGO = { left: 834, top: 446, width: 36, height: 28 }
const LOGO_SURROUNDING = { left: 816, top: 450, width: 16, height: 20 }

const TEXTURE_SIZE = 1024
const JPEG = { quality: 86, mozjpeg: true }

export async function colorTexture(image: Uint8Array): Promise<Buffer> {
  // (stats() reads the whole input, not the extract: the crop is made first.)
  const { channels } = await sharp(await sharp(image).extract(LOGO_SURROUNDING).toBuffer()).stats()
  const [r, g, b] = channels.map((channel) => Math.round(channel.mean))
  const patch = { create: { width: LOGO.width, height: LOGO.height, channels: 3 as const, background: { r, g, b } } }
  return sharp(image)
    .composite([{ input: patch, left: LOGO.left, top: LOGO.top }])
    .flatten({ background: '#000000' })
    .jpeg(JPEG)
    .toBuffer()
}

// The dish's (and the bus ring's) texture: shades of grey only.
export async function greyTexture(image: Uint8Array): Promise<Buffer> {
  return sharp(image).flatten({ background: '#000000' }).toColourspace('b-w').jpeg(JPEG).toBuffer()
}

// A level above which a pixel belongs to the record (the photos show it on black).
const DISC_LEVEL = 40
// A row or column crosses the record when this share of its pixels is that bright.
const DISC_SHARE = 0.02

// Crops a photo of the record (the cover or the label side) to the record's square, at the
// texture size: the record's rim touches the texture's edges, so the app can cut the disc out by
// distance from the middle.
export async function recordTexture(photo: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(photo).greyscale().raw().toBuffer({ resolveWithObject: true })
  const columns = brightRange(info.width, (x) => countBright(data, { start: x, step: info.width, count: info.height }) / info.height)
  const rows = brightRange(info.height, (y) => countBright(data, { start: y * info.width, step: 1, count: info.width }) / info.width)
  const side = Math.max(columns.end - columns.start, rows.end - rows.start)
  return sharp(photo)
    .extract({ left: columns.start, top: rows.start, width: Math.min(side, info.width - columns.start), height: Math.min(side, info.height - rows.start) })
    .resize(TEXTURE_SIZE, TEXTURE_SIZE, { fit: 'fill' })
    .jpeg(JPEG)
    .toBuffer()
}

function countBright(data: Buffer, { start, step, count }: { start: number; step: number; count: number }): number {
  let bright = 0
  for (let i = 0; i < count; i++) if (data[start + i * step] > DISC_LEVEL) bright++
  return bright
}

function brightRange(length: number, share: (index: number) => number): { start: number; end: number } {
  let start = 0
  let end = length
  while (start < length && share(start) < DISC_SHARE) start++
  while (end > start && share(end - 1) < DISC_SHARE) end--
  return { start, end }
}
