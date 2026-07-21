import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { deriveBumpMapBuffer } from '../src/deriveGasGiantBumpMaps'

describe('deriveBumpMapBuffer', () => {
  it('produces a grayscale image the same dimensions as the input', async () => {
    // A tiny synthetic 4x4 RGB test image with varying brightness, standing in for a real albedo
    // texture - deriveBumpMapBuffer shouldn't care about image content beyond luminance.
    const input = await sharp({
      create: { width: 4, height: 4, channels: 3, background: { r: 100, g: 150, b: 200 } },
    })
      .png()
      .toBuffer()

    const output = await deriveBumpMapBuffer(input)
    const outputMeta = await sharp(output).metadata()

    expect(outputMeta.width).toBe(4)
    expect(outputMeta.height).toBe(4)
  })

  it('maps brighter input regions to brighter output (luminance-derived)', async () => {
    const darkInput = await sharp({
      create: { width: 2, height: 2, channels: 3, background: { r: 20, g: 20, b: 20 } },
    })
      .png()
      .toBuffer()
    const brightInput = await sharp({
      create: { width: 2, height: 2, channels: 3, background: { r: 220, g: 220, b: 220 } },
    })
      .png()
      .toBuffer()

    const darkOutput = await deriveBumpMapBuffer(darkInput)
    const brightOutput = await deriveBumpMapBuffer(brightInput)

    const darkStats = await sharp(darkOutput).stats()
    const brightStats = await sharp(brightOutput).stats()

    expect(brightStats.channels[0].mean).toBeGreaterThan(darkStats.channels[0].mean)
  })
})
