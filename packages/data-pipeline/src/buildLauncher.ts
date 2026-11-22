import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ModelDescription } from '../../app/src/spacecraft/modelFile'
import { launcherModels } from './apollo/launcherModel'
import { LAUNCHER_PARTS } from './apollo/launcherNassp'
import { nasspPalette, nasspTexture } from './apollo/nasspParts'
import { PAINT_TEXTURE, PALETTE_TEXTURE } from './apollo/saturnVParts'
import { assemblyAnchors, assignAssemblies } from './spacecraft/assemblies'
import type { MeshPrimitive } from './spacecraft/glbMesh'
import { packModel } from './spacecraft/modelWriter'

// Builds the launch tower lesson's models: Project Apollo - NASSP's mobile launcher (with its
// tower, arms and masts, which fold as NASSP's animations turn them) carrying our Saturn V, and
// NASSP's crawler-transporter (GPL-2.0-or-later, apollo/nassp.ts, at its pinned commit). Writes
// packages/app/public/models/launcher/: launcher.*, crawler.*, the textures, and a copy of the
// Saturn V's paint and palette (`npm run build-saturn-v` first).
//
// `npm run build-launcher`

export const LAUNCHER_ASSEMBLIES = [...LAUNCHER_PARTS, 'rocket', 'person'] as const

const APP = join(dirname(fileURLToPath(import.meta.url)), '../../app/public/models')

function written(parts: Map<string, MeshPrimitive[]>, order: readonly string[], extra: Partial<ModelDescription>, lift: number): { description: ModelDescription; binary: Buffer } {
  const { binary, description } = packModel(assignAssemblies(parts, order))
  const hinges = (extra as { hinges?: Record<string, ModelDescription['assemblies'][number]['hinge']> }).hinges ?? {}
  // On the crawler, everything but the person rises by the crawler's height.
  const assemblies = order.map((id) => ({ id, explode: [0, id === 'person' || id === 'crawler' ? 0 : lift, 0] as [number, number, number], ...(hinges[id] ? { hinge: hinges[id] } : {}) }))
  return { description: { ...description, assemblies, anchors: assemblyAnchors(parts, (id) => id === 'tower' || id === 'rocket'), ...(extra.marks ? { marks: extra.marks } : {}) }, binary }
}

function write(out: string, name: string, { description, binary }: { description: ModelDescription; binary: Buffer }): number {
  writeFileSync(join(out, `${name}.bin`), binary)
  writeFileSync(join(out, `${name}.json`), JSON.stringify(description, null, 1) + '\n')
  console.log(`${name}: ${description.vertexCount} vertices, ${description.indexCount / 3} triangles`)
  return binary.length
}

export async function buildLauncher(out: string): Promise<void> {
  mkdirSync(join(out, 'nassp'), { recursive: true })
  const models = await launcherModels()
  // The deck, and the top of the tower's steel.
  const marks = { deck: models.deck, tower: models.towerTop }
  let bytes = write(out, 'launcher', written(models.launcher, LAUNCHER_ASSEMBLIES, { hinges: models.hinges, marks } as Partial<ModelDescription>, models.crawlerTop))
  bytes += write(out, 'crawler', written(models.crawler, ['crawler'], {}, 0))
  for (const file of [PAINT_TEXTURE, PALETTE_TEXTURE]) copyFileSync(join(APP, 'saturnV', file), join(out, file))
  const images: [string, Buffer][] = [['nassp/palette.png', await nasspPalette(models.palette)]]
  for (const [file, path] of models.textures) images.push([file, await nasspTexture(file, path)])
  for (const [file, image] of images) {
    writeFileSync(join(out, file), image)
    bytes += image.length
  }
  console.log(`launcher: ${(bytes / 1e6).toFixed(1)} MB with its textures`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await buildLauncher(join(APP, 'launcher'))
}
