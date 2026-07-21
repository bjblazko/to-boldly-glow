import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

// Converts an existing gas-giant albedo texture into a synthetic grayscale "pseudo-bump" map by
// boosting local luminance contrast. There is no real published "cloud-top height" data for any gas
// giant - this is a deliberate stylization derived entirely from data already licensed and checked
// into this repo (the body's own color texture), not a claim of real elevation data. See
// CREDITS.md's entry for this script for the exact wording used to document that distinction.
export async function deriveBumpMapBuffer(inputPngOrJpg: Buffer): Promise<Buffer> {
  return sharp(inputPngOrJpg)
    .grayscale()
    .normalize() // stretches the luminance histogram to use the full [0, 255] range
    .linear(1.4, -20) // mild extra contrast boost beyond normalize() alone
    .png()
    .toBuffer()
}

const GAS_GIANTS = ['jupiter', 'saturn', 'uranus', 'neptune'] as const

// Only run when executed directly (`npm run derive-bump-maps`), not when imported for tests -
// mirrors convertBrightStarCatalog.ts's existing guard pattern in this same package.
if (import.meta.url === `file://${process.argv[1]}`) {
  const here = dirname(fileURLToPath(import.meta.url))
  const texturesDir = join(here, '../../app/public/textures')

  for (const bodyId of GAS_GIANTS) {
    const inputPath = join(texturesDir, `${bodyId}.jpg`)
    const outputPath = join(texturesDir, `${bodyId}_bump.png`)
    const input = readFileSync(inputPath)
    const output = await deriveBumpMapBuffer(input)
    writeFileSync(outputPath, output)
    console.log(`Wrote ${outputPath}`)
  }
}
