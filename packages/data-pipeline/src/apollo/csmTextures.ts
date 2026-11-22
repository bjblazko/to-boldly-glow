import sharp from 'sharp'
import { CSM_HEIGHTS, CSM_RADIUS, RCS_QUAD } from './csmProfile'
import { weather } from './weathering'

const RCS_PANEL = RCS_QUAD.panel
const SM_HEIGHT = CSM_HEIGHTS.smTop - CSM_HEIGHTS.aftBulkhead

// The service module's skin, drawn from photos of the Apollo command and service modules in flight:
// bare aluminium in six sectors, a band of white radiator panels round its top (the fuel cells'),
// two white radiator panels low on opposite sides (the cabin's cooling), and the wear of its days on
// the pad (weathering.ts). One image wraps once round the module (x) and runs from its top (y 0) to
// its base. A plain approximation, not a copy of any photo.

const WIDTH = 1024
const HEIGHT = 512
const ALUMINIUM = '#b8bbbf'
const WHITE = '#ecebe7'
const SEAM = '#8d9095'

function rect(x: number, y: number, width: number, height: number, fill: string): string {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}"/>`
}

function paintSvg(): string {
  const parts = [rect(0, 0, WIDTH, HEIGHT, ALUMINIUM)]
  // The fuel cells' radiators: white stripes round the top quarter, thin bare gaps between.
  const band = HEIGHT * 0.26
  for (let i = 0; i < 9; i++) parts.push(rect(0, HEIGHT * 0.02 + (i * band) / 9, WIDTH, (band / 9) * 0.68, WHITE))
  // The cabin's two radiators, an eighth of the way round each, on opposite sides.
  for (const middle of [0.25, 0.75]) parts.push(rect(WIDTH * (middle - 0.0625), HEIGHT * 0.42, WIDTH * 0.125, HEIGHT * 0.44, WHITE))
  // The four RCS quads' panels, flush with the skin, a little darker (8 ft by nearly 3 ft, centred on
  // the quads: 45 degrees round, then every 90; their middle 3 m above the aft bulkhead).
  for (let k = 0; k < 4; k++) {
    const middle = (0.125 + k * 0.25) * WIDTH
    const across = (RCS_PANEL.width / (2 * Math.PI * CSM_RADIUS)) * WIDTH
    const tall = (RCS_PANEL.length / SM_HEIGHT) * HEIGHT
    const centre = ((CSM_HEIGHTS.smTop - RCS_QUAD.middle) / SM_HEIGHT) * HEIGHT
    parts.push(rect(middle - across / 2, centre - tall / 2, across, tall, '#a7aaae'))
  }
  // The six sectors' seams.
  for (let k = 0; k < 6; k++) parts.push(rect((k * WIDTH) / 6, 0, 2, HEIGHT, SEAM))
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">${parts.join('')}</svg>`
}

export async function smPaint(): Promise<Buffer> {
  const { data, info } = await sharp(Buffer.from(paintSvg())).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const worn = weather(new Uint8Array(data), info.width, info.height)
  return sharp(Buffer.from(worn), { raw: { width: info.width, height: info.height, channels: 3 } }).jpeg({ quality: 88, mozjpeg: true }).toBuffer()
}
