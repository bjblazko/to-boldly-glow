// A DDS texture (as Orbiter's add-ons ship them) decoded to RGBA pixels: its largest image only,
// block-compressed (DXT1, DXT3, DXT5) or uncompressed 32-bit BGRA/24-bit BGR - or, where an add-on
// ships a BMP under a .dds name, that BMP (uncompressed, 24 or 32 bits).

export interface RgbaImage {
  width: number
  height: number
  rgba: Uint8Array
}

const HEADER = 128

export function decodeDds(file: Buffer): RgbaImage {
  if (file.toString('ascii', 0, 2) === 'BM') return decodeBmp(file)
  if (file.toString('ascii', 0, 4) !== 'DDS ') throw new Error('Not a DDS file')
  const height = file.readUInt32LE(12)
  const width = file.readUInt32LE(16)
  const fourCC = file.toString('ascii', 84, 88)
  const flags = file.readUInt32LE(80)
  const data = file.subarray(HEADER)
  const rgba = new Uint8Array(width * height * 4)
  if (flags & 4) decodeBlocks(data, { width, height, rgba }, fourCC)
  else decodeUncompressed(data, { width, height, rgba }, file.readUInt32LE(88) / 8)
  return { width, height, rgba }
}

function decodeUncompressed(data: Buffer, { width, height, rgba }: RgbaImage, bytes: number): void {
  for (let p = 0; p < width * height; p++) {
    const o = p * bytes
    rgba.set([data[o + 2], data[o + 1], data[o], bytes === 4 ? data[o + 3] : 255], p * 4)
  }
}

const BLOCK_BYTES: Record<string, number> = { DXT1: 8, DXT3: 16, DXT5: 16 }

function decodeBlocks(data: Buffer, image: RgbaImage, fourCC: string): void {
  const size = BLOCK_BYTES[fourCC]
  if (!size) throw new Error(`DDS format ${fourCC} is not supported`)
  const across = Math.max(1, Math.ceil(image.width / 4))
  const down = Math.max(1, Math.ceil(image.height / 4))
  for (let by = 0; by < down; by++) {
    for (let bx = 0; bx < across; bx++) {
      const block = data.subarray((by * across + bx) * size, (by * across + bx + 1) * size)
      const alpha = fourCC === 'DXT5' ? interpolatedAlpha(block) : fourCC === 'DXT3' ? explicitAlpha(block) : null
      const colors = colorBlock(block.subarray(size - 8), fourCC === 'DXT1')
      writeBlock(image, [bx * 4, by * 4], colors, alpha)
    }
  }
}

function writeBlock({ width, height, rgba }: RgbaImage, [x0, y0]: [number, number], colors: number[][], alpha: number[] | null): void {
  for (let k = 0; k < 16; k++) {
    const [x, y] = [x0 + (k % 4), y0 + Math.floor(k / 4)]
    if (x >= width || y >= height) continue
    const color = colors[k]
    rgba.set([color[0], color[1], color[2], alpha ? alpha[k] : color[3]], (y * width + x) * 4)
  }
}

function rgb565(value: number): number[] {
  return [((value >> 11) & 31) * (255 / 31), ((value >> 5) & 63) * (255 / 63), (value & 31) * (255 / 31)].map(Math.round)
}

// The 16 pixels' colours of a colour block (DXT1's may have a transparent fourth).
function colorBlock(block: Buffer, dxt1: boolean): number[][] {
  const [v0, v1] = [block.readUInt16LE(0), block.readUInt16LE(2)]
  const [c0, c1] = [rgb565(v0), rgb565(v1)]
  const mix = (a: number, b: number, t: number) => c0.map((_, i) => Math.round((a === 0 ? c0 : c1)[i] * (1 - t) + (b === 0 ? c0 : c1)[i] * t))
  const four = !dxt1 || v0 > v1
  const palette = four ? [[...c0, 255], [...c1, 255], [...mix(0, 1, 1 / 3), 255], [...mix(0, 1, 2 / 3), 255]] : [[...c0, 255], [...c1, 255], [...mix(0, 1, 0.5), 255], [0, 0, 0, 0]]
  const bits = block.readUInt32LE(4)
  return Array.from({ length: 16 }, (_, k) => palette[(bits >>> (k * 2)) & 3])
}

function explicitAlpha(block: Buffer): number[] {
  return Array.from({ length: 16 }, (_, k) => ((block[k >> 1] >> ((k & 1) * 4)) & 15) * 17)
}

function interpolatedAlpha(block: Buffer): number[] {
  const [a0, a1] = [block[0], block[1]]
  const levels = a0 > a1 ? [a0, a1, ...[1, 2, 3, 4, 5, 6].map((i) => Math.round(((7 - i) * a0 + i * a1) / 7))] : [a0, a1, ...[1, 2, 3, 4].map((i) => Math.round(((5 - i) * a0 + i * a1) / 5)), 0, 255]
  let bits = 0n
  for (let i = 0; i < 6; i++) bits |= BigInt(block[2 + i]) << BigInt(8 * i)
  return Array.from({ length: 16 }, (_, k) => levels[Number((bits >> BigInt(3 * k)) & 7n)])
}

function decodeBmp(file: Buffer): RgbaImage {
  const at = file.readUInt32LE(10)
  const width = file.readInt32LE(18)
  const rows = file.readInt32LE(22)
  const bytes = file.readUInt16LE(28) / 8
  if (file.readUInt32LE(30) !== 0 && file.readUInt32LE(30) !== 3) throw new Error('Compressed BMP is not supported')
  const height = Math.abs(rows)
  const stride = Math.ceil((width * bytes) / 4) * 4
  const rgba = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    // Rows run bottom-up unless the height is negative.
    const row = at + (rows > 0 ? height - 1 - y : y) * stride
    for (let x = 0; x < width; x++) {
      const o = row + x * bytes
      rgba.set([file[o + 2], file[o + 1], file[o], bytes === 4 ? file[o + 3] : 255], (y * width + x) * 4)
    }
  }
  return { width, height, rgba }
}
