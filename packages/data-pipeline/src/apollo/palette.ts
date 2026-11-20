import sharp from 'sharp'

// A palette texture: a row of flat swatches a model's plain parts sample (tanks, engines), each
// part's texture coordinate in the middle of its swatch.

export type Rgb = readonly [number, number, number]

const SWATCH_SIZE = 8

// The middle of a swatch, as a texture coordinate.
export function swatchUv<Name extends string>(names: readonly Name[], name: Name): [number, number] {
  return [(names.indexOf(name) + 0.5) / names.length, 0.5]
}

// The palette image: one swatch per colour, left to right.
export function paletteTexture(colors: readonly Rgb[]): Promise<Buffer> {
  const width = colors.length * SWATCH_SIZE
  const pixels = Buffer.alloc(width * SWATCH_SIZE * 3)
  for (let x = 0; x < width; x++) {
    const color = colors[Math.floor(x / SWATCH_SIZE)]
    for (let row = 0; row < SWATCH_SIZE; row++) pixels.set(color, (row * width + x) * 3)
  }
  return sharp(pixels, { raw: { width, height: SWATCH_SIZE, channels: 3 } }).png().toBuffer()
}
