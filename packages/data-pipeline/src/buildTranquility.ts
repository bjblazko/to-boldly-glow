import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fromFile } from 'geotiff'
import sharp from 'sharp'
import { evenShadows, fitSun, type Raster } from './apollo/terrain/evenShadows'
import { type MapGeometry, mapGeometry, parseLabel, pixelOf, placeOf } from './apollo/terrain/pdsLabel'
import { destriped, seamSteps, withoutSeams } from './apollo/terrain/seams'
import { cropAround, halve, packHeights, toGrey } from './apollo/terrain/tranquilityTile'
import { TRANQUILITY_BASE } from './apollo/trajectory/apollo11LunarFit'

// Tranquility Base's terrain for the tour: LROC's NAC terrain model of the Apollo 11 site (2 m) and
// its orthophoto (NAC M150361817, 2 m), NASA's PDS archive (LRO-L-LROC-5-RDR-V1.0, product
// NAC_DTM_APOLLO11 v1.9, public domain; NASA/GSFC/Arizona State University; Henriksen et al. 2017).
// Downloaded by hand into cache/lroc-apollo11 (not committed). Out: the square around the site as
// wide as the strip has data everywhere (some 4 km), heights at 4 m in 16 bits, the photo with its
// own shadows evened out at 2 m as a JPEG, and what places them (tranquility.json).

const HERE = dirname(fileURLToPath(import.meta.url))
const CACHE = join(HERE, '../cache/lroc-apollo11')
const OUT = join(HERE, '../../app/public/data/apollo11/terrain')
const PREVIEW = process.env.TERRAIN_PREVIEW_DIR
// Heights in the tour are from the Moon's centre less the descent's site radius (apollo11Descent.ts).
const SITE_RADIUS_M = 1735500
// Rows read around the site: the square's side plus a margin.
const HALF_WINDOW = 1100
const NODATA_BELOW = -1e30
// Pixels either side the heights are averaged over before they light the photo (see evenShadows).
const SMOOTHING = 2
const PHOTO_NULL_UP_TO = -32764

async function readTerrain(firstLine: number): Promise<Raster> {
  const image = await (await fromFile(join(CACHE, 'NAC_DTM_APOLLO11.TIF'))).getImage()
  const width = image.getWidth()
  const [band] = (await image.readRasters({ window: [0, firstLine, width, firstLine + 2 * HALF_WINDOW] })) as unknown as Float32Array[]
  return { width, height: 2 * HALF_WINDOW, data: band.map((value) => (value < NODATA_BELOW ? Number.NaN : value)) }
}

// The orthophoto: a PDS3 image with its label at the head, 16-bit little-endian samples; its map
// must be the terrain model's, pixel for pixel.
function readPhoto(geometry: MapGeometry, firstLine: number): Raster {
  const bytes = readFileSync(join(CACHE, 'NAC_DTM_APOLLO11_M150361817_2M.IMG'))
  const label = parseLabel(bytes.subarray(0, 16384).toString('latin1'))
  const own = mapGeometry(label)
  if (own.lineOffset !== geometry.lineOffset || own.sampleOffset !== geometry.sampleOffset || own.scale !== geometry.scale) throw new Error('orthophoto: not on the terrain model’s map')
  if (label.SAMPLE_TYPE !== 'LSB_INTEGER' || label.SAMPLE_BITS !== '16') throw new Error(`orthophoto: unexpected samples ${label.SAMPLE_TYPE}/${label.SAMPLE_BITS}`)
  const [record, width] = [Number(label.RECORD_BYTES), Number(label.LINE_SAMPLES)]
  const start = (Number(label['^IMAGE']) - 1) * record
  const data = Float32Array.from({ length: width * 2 * HALF_WINDOW }, (_, i) => {
    const value = bytes.readInt16LE(start + (firstLine + Math.floor(i / width)) * record + (i % width) * 2)
    return value <= PHOTO_NULL_UP_TO ? Number.NaN : value
  })
  return { width, height: 2 * HALF_WINDOW, data }
}

// The columns with data in every row of both rasters.
function fullColumns(...rasters: Raster[]): { first: number; last: number } {
  const { width, height } = rasters[0]
  const full = (column: number) => rasters.every(({ data }) => Array.from({ length: height }, (_, row) => data[row * width + column]).every(Number.isFinite))
  let [first, last] = [0, width - 1]
  while (!full(first)) first++
  while (!full(last)) last--
  return { first, last }
}

async function writeGrey(path: string, grey: Uint8Array, size: number): Promise<void> {
  await sharp(Buffer.from(grey), { raw: { width: size, height: size, channels: 1 } }).jpeg({ quality: 85 }).toFile(path)
}

// Before and after side by side, 600 px around the site at 2 m, for a look.
async function writePreview(before: Uint8Array, after: Uint8Array, size: number, site: { x: number; y: number }): Promise<void> {
  if (!PREVIEW) return
  mkdirSync(PREVIEW, { recursive: true })
  const window = 600
  const [left, top] = [Math.max(0, Math.round(site.x - window / 2)), Math.max(0, Math.round(site.y - window / 2))]
  const part = (grey: Uint8Array) => sharp(Buffer.from(grey), { raw: { width: size, height: size, channels: 1 } }).extract({ left, top, width: window, height: window }).png().toBuffer()
  const whole = (grey: Uint8Array) => sharp(Buffer.from(grey), { raw: { width: size, height: size, channels: 1 } }).resize(1000, 1000).png().toBuffer()
  const pair = async (a: Buffer, b: Buffer, side: number, path: string) =>
    sharp({ create: { width: side * 2 + 10, height: side, channels: 3, background: '#000' } }).composite([{ input: a, left: 0, top: 0 }, { input: b, left: side + 10, top: 0 }]).png().toFile(path)
  await pair(await part(before), await part(after), window, join(PREVIEW, 'tranquility-site-before-after.png'))
  await pair(await whole(before), await whole(after), 1000, join(PREVIEW, 'tranquility-tile-before-after.png'))
}

interface Tile {
  geometry: MapGeometry
  // The tile's north-west pixel in the product, and the site's place in the tile (2 m pixels).
  origin: { line: number; sample: number }
  site: { x: number; y: number }
  size: number
  // Heights (metres above SITE_RADIUS_M) and the photo, at 2 m.
  heights: Raster
  photo: Raster
  seams: { column: number; step: number }[]
}

// The square around the site from both products, its heights' seams taken out.
async function cutTile(): Promise<Tile> {
  const geometry = mapGeometry(parseLabel(readFileSync(join(CACHE, 'NAC_DTM_APOLLO11.LBL'), 'latin1')))
  const site = pixelOf(geometry, TRANQUILITY_BASE.latitude, TRANQUILITY_BASE.longitude)
  const firstLine = Math.round(site.line) - HALF_WINDOW
  const [terrain, photo] = [await readTerrain(firstLine), readPhoto(geometry, firstLine)]
  const columns = fullColumns(terrain, photo)
  const size = (columns.last - columns.first + 1) & ~1
  const centre = { line: site.line - firstLine, sample: site.sample }
  const heights = cropAround(terrain, centre, size, columns)
  const above: Raster = { ...heights.raster, data: heights.raster.data.map((value) => value + geometry.radius - SITE_RADIUS_M) }
  const seams = seamSteps(above).flatMap((step, column) => (step === 0 ? [] : [{ column, step: Math.round(step * 1000) / 1000 }]))
  const origin = { line: firstLine + heights.origin.line, sample: heights.origin.sample }
  return { geometry, origin, site: { x: site.sample - origin.sample, y: site.line - origin.line }, size, heights: withoutSeams(above), photo: cropAround(photo, centre, size, columns).raster, seams }
}

export async function buildTranquility(): Promise<Record<string, unknown>> {
  const tile = await cutTile()
  const sun = fitSun(tile.heights, tile.photo, tile.geometry.scale)
  const albedo = destriped(evenShadows(tile.heights, tile.photo, { sun, spacing: tile.geometry.scale, smoothing: SMOOTHING }))
  const coarse = halve(tile.heights)
  const packed = packHeights(coarse)
  mkdirSync(OUT, { recursive: true })
  writeFileSync(join(OUT, 'tranquility-heights.bin'), Buffer.from(packed.values.buffer))
  const [before, after] = [toGrey(tile.photo), toGrey(albedo)]
  await writeGrey(join(OUT, 'tranquility-albedo.jpg'), after, tile.size)
  await writePreview(before, after, tile.size, tile.site)
  const meta = describe(tile, { coarse, packed, sun })
  writeFileSync(join(OUT, 'tranquility.json'), `${JSON.stringify(meta, null, 2)}\n`)
  return meta
}

// What places the tile: tranquility.json.
function describe(tile: Tile, { coarse, packed, sun }: { coarse: Raster; packed: { offset: number; scale: number }; sun: [number, number, number] }): Record<string, unknown> {
  const { geometry, origin, site, size } = tile
  const corner = (line: number, sample: number) => placeOf(geometry, origin.line + line, origin.sample + sample)
  const [northWest, southEast] = [corner(-0.5, -0.5), corner(size - 0.5, size - 0.5)]
  return {
    source: 'LROC NAC DTM and orthophoto (NAC M150361817) of the Apollo 11 site: NASA PDS LRO-L-LROC-5-RDR-V1.0, NAC_DTM_APOLLO11 v1.9, public domain; NASA/GSFC/Arizona State University',
    // Row 0 is the north edge, column 0 the west edge; latitude and longitude of the outer edges.
    bounds: { north: northWest.latitude, south: southEast.latitude, west: northWest.longitude, east: southEast.longitude },
    referenceRadiusKm: SITE_RADIUS_M / 1000,
    heights: { file: 'tranquility-heights.bin', width: coarse.width, height: coarse.height, spacingMetres: geometry.scale * 2, offset: packed.offset, scale: packed.scale, format: 'uint16 little-endian; metres = offset + value × scale' },
    albedo: { file: 'tranquility-albedo.jpg', width: size, height: size, spacingMetres: geometry.scale },
    site: { latitude: TRANQUILITY_BASE.latitude, longitude: TRANQUILITY_BASE.longitude, albedo: site, heights: { x: site.x / 2, y: site.y / 2 }, heightMetres: tile.heights.data[Math.round(site.y) * size + Math.round(site.x)] },
    // Steps taken out of the terrain model where its stereo models meet (columns of the 2 m grid).
    seams: tile.seams,
    photoSun: { east: sun[0], north: sun[1], up: sun[2], incidenceDegrees: (Math.acos(sun[2]) * 180) / Math.PI },
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const meta = await buildTranquility()
  console.log(JSON.stringify(meta, null, 2))
}
