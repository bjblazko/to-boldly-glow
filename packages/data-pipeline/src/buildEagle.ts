import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ModelDescription } from '../../app/src/spacecraft/modelFile'
import { cockpitParts, cockpitTextures } from './apollo/lmCockpit'
import { LM_ASSEMBLIES, LM_DECAL_TEXTURE, LM_PLAQUE_TEXTURE, type LmAssembly, lmAssemblyKind, lmExplodeOffset, lmHinge, lmParts, swatch } from './apollo/lmParts'
import { LM_HEIGHTS } from './apollo/lmProfile'
import { flagLettering, foilTexture, LM_FOIL_TEXTURES, LM_PALETTE_TEXTURE, lmPalette, plaqueTexture, type FoilTint } from './apollo/lmTextures'
import { assemblyAnchors, assignAssemblies } from './spacecraft/assemblies'
import { packModel } from './spacecraft/modelWriter'

// Builds Apollo 11's lunar module Eagle from its dimensions (apollo/lmProfile.ts): one model, the
// cockpit inside the ascent stage, and its textures, all our own. Writes
// packages/app/public/models/eagle/: lm.json, lm.bin and the images.
//
// `npm run build-eagle`

const COCKPIT_LOOKS = { wall: swatch('ascent'), floor: swatch('ascentDark'), dark: swatch('black'), glass: swatch('glass'), steel: swatch('steel') }

function model(): { description: ModelDescription; binary: Buffer } {
  const parts = lmParts()
  for (const [part, primitives] of cockpitParts(COCKPIT_LOOKS)) parts.set(part, primitives)
  const { binary, description } = packModel(assignAssemblies(parts, LM_ASSEMBLIES))
  const assemblies = LM_ASSEMBLIES.map((id) => {
    const hinge = lmHinge(id)
    return { id, explode: lmExplodeOffset(id), kind: lmAssemblyKind(id), ...(hinge ? { hinge } : {}) }
  })
  // Labels point at the middle of each part; the stages' at their axis, inside them whichever way
  // the model has turned.
  const onAxis = (assembly: LmAssembly) => assembly === 'descent' || assembly === 'ascent'
  const marks = { descent: LM_HEIGHTS.interstage, ascent: LM_HEIGHTS.overall }
  return { description: { ...description, assemblies, anchors: assemblyAnchors(parts, onAxis), marks }, binary }
}

async function textures(): Promise<Map<string, Buffer>> {
  const foils = await Promise.all((Object.keys(LM_FOIL_TEXTURES) as FoilTint[]).map(async (tint, index) => [LM_FOIL_TEXTURES[tint], await foilTexture(index + 1, tint)] as [string, Buffer]))
  return new Map([
    ...foils,
    [LM_PALETTE_TEXTURE, await lmPalette()],
    [LM_PLAQUE_TEXTURE, await plaqueTexture()],
    [LM_DECAL_TEXTURE, await flagLettering()],
    ...(await cockpitTextures()),
  ])
}

export async function buildEagle(out: string): Promise<void> {
  mkdirSync(out, { recursive: true })
  const { description, binary } = model()
  writeFileSync(join(out, 'lm.bin'), binary)
  writeFileSync(join(out, 'lm.json'), JSON.stringify(description, null, 1) + '\n')
  let bytes = binary.length
  for (const [file, image] of await textures()) {
    writeFileSync(join(out, file), image)
    bytes += image.length
  }
  console.log(`lm: ${description.vertexCount} vertices, ${description.indexCount / 3} triangles, ${(bytes / 1e6).toFixed(1)} MB with its textures`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await buildEagle(join(dirname(fileURLToPath(import.meta.url)), '../../app/public/models/eagle'))
}
