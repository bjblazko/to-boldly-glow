import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ModelDescription } from '../../app/src/spacecraft/modelFile'
import { cockpitParts, cockpitTextures } from './apollo/lmCockpit'
import { COCKPIT_ASSEMBLIES, LM_ASSEMBLIES, LM_DECAL_TEXTURE, LM_PLAQUE_TEXTURE, type LmAssembly, lmAssemblyKind, lmExplodeOffset, lmHinge, lmParts, swatch } from './apollo/lmParts'
import { LM_HEIGHTS } from './apollo/lmProfile'
import { flagLettering, foilTexture, LM_FOIL_TEXTURES, LM_PALETTE_TEXTURE, lmPalette, plaqueTexture, type FoilTint } from './apollo/lmTextures'
import { assemblyAnchors, assignAssemblies } from './spacecraft/assemblies'
import type { MeshPrimitive } from './spacecraft/glbMesh'
import { packModel } from './spacecraft/modelWriter'

// Builds Apollo 11's lunar module Eagle from its dimensions (apollo/lmProfile.ts): the outside and
// the cockpit (a model of its own, lit by its lamps, as Columbia's cabin is) and their textures, all
// our own. Writes packages/app/public/models/eagle/: lm.*, cockpit.* and the images.
//
// `npm run build-eagle`

const COCKPIT_LOOKS = { wall: swatch('ascent'), floor: swatch('ascentDark'), dark: swatch('black'), glass: swatch('glass'), steel: swatch('steel') }

function written(parts: Map<LmAssembly, MeshPrimitive[]>, order: readonly LmAssembly[], marks?: Record<string, number>): { description: ModelDescription; binary: Buffer } {
  const { binary, description } = packModel(assignAssemblies(parts, order))
  const assemblies = order.map((id) => {
    const hinge = lmHinge(id)
    return { id, explode: lmExplodeOffset(id), kind: lmAssemblyKind(id), ...(hinge ? { hinge } : {}) }
  })
  // Labels point at the middle of each part; the stages' at their axis, inside them whichever way
  // the model has turned.
  const onAxis = (assembly: LmAssembly) => assembly === 'descent' || assembly === 'ascent'
  return { description: { ...description, assemblies, anchors: assemblyAnchors(parts, onAxis), ...(marks ? { marks } : {}) }, binary }
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

function write(out: string, name: string, { description, binary }: { description: ModelDescription; binary: Buffer }): number {
  writeFileSync(join(out, `${name}.bin`), binary)
  writeFileSync(join(out, `${name}.json`), JSON.stringify(description, null, 1) + '\n')
  console.log(`${name}: ${description.vertexCount} vertices, ${description.indexCount / 3} triangles`)
  return binary.length
}

export async function buildEagle(out: string): Promise<void> {
  mkdirSync(out, { recursive: true })
  let bytes = write(out, 'lm', written(lmParts(), LM_ASSEMBLIES, { descent: LM_HEIGHTS.interstage, ascent: LM_HEIGHTS.overall }))
  bytes += write(out, 'cockpit', written(cockpitParts(COCKPIT_LOOKS), COCKPIT_ASSEMBLIES))
  for (const [file, image] of await textures()) {
    writeFileSync(join(out, file), image)
    bytes += image.length
  }
  console.log(`eagle: ${(bytes / 1e6).toFixed(1)} MB with its textures`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await buildEagle(join(dirname(fileURLToPath(import.meta.url)), '../../app/public/models/eagle'))
}
