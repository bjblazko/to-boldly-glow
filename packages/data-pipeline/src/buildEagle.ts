import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Hinge } from '../../app/src/spacecraft/modelHinge'
import type { ModelDescription } from '../../app/src/spacecraft/modelFile'
import { NASSP_PALETTE_TEXTURE, nasspModels } from './apollo/lmNasspModel'
import { nasspPalette, nasspTexture } from './apollo/nasspParts'
import { COCKPIT_ASSEMBLIES, LM_ASSEMBLIES, type LmAssembly, lmAssemblyKind, lmExplodeOffset, lmInsides } from './apollo/lmParts'
import { LM_HEIGHTS } from './apollo/lmProfile'
import { LM_PALETTE_TEXTURE, lmPalette } from './apollo/lmTextures'
import { assemblyAnchors, assignAssemblies } from './spacecraft/assemblies'
import type { MeshPrimitive } from './spacecraft/glbMesh'
import { packModel } from './spacecraft/modelWriter'

// Builds Apollo 11's lunar module Eagle: the outside and the cockpit from Project Apollo - NASSP's
// meshes and textures (GPL-2.0-or-later, apollo/nassp.ts, downloaded at a pinned commit), turned
// into our frame and model format; the cutaway's tanks and engines and a person for scale from the
// dimensions (apollo/lmProfile.ts). Writes packages/app/public/models/eagle/: lm.* (outside),
// cockpit.* (inside, a model of its own lit by its lamps, as Columbia's cabin) and the images.
//
// `npm run build-eagle`

function written(parts: Map<string, MeshPrimitive[]>, order: readonly LmAssembly[], extra: { hinges?: Record<string, Hinge>; marks?: Record<string, number> }): { description: ModelDescription; binary: Buffer } {
  const present = new Map([...parts].filter(([part]) => order.includes(part as LmAssembly))) as Map<LmAssembly, MeshPrimitive[]>
  const { binary, description } = packModel(assignAssemblies(present, order))
  const assemblies = order.map((id) => {
    const hinge = extra.hinges?.[id]
    return { id, explode: lmExplodeOffset(id), kind: lmAssemblyKind(id), ...(hinge ? { hinge } : {}) }
  })
  // Labels point at the middle of each part; the stages' at their axis, inside them whichever way
  // the model has turned.
  const onAxis = (assembly: LmAssembly) => assembly === 'descent' || assembly === 'ascent'
  return { description: { ...description, assemblies, anchors: assemblyAnchors(present, onAxis), ...(extra.marks ? { marks: extra.marks } : {}) }, binary }
}

function write(out: string, name: string, { description, binary }: { description: ModelDescription; binary: Buffer }): number {
  writeFileSync(join(out, `${name}.bin`), binary)
  writeFileSync(join(out, `${name}.json`), JSON.stringify(description, null, 1) + '\n')
  console.log(`${name}: ${description.vertexCount} vertices, ${description.indexCount / 3} triangles`)
  return binary.length
}

export async function buildEagle(out: string): Promise<void> {
  mkdirSync(join(out, 'nassp'), { recursive: true })
  const nassp = await nasspModels()
  const outside = new Map([...nassp.outside, ...lmInsides()])
  let bytes = write(out, 'lm', written(outside, LM_ASSEMBLIES, { hinges: nassp.hinges, marks: { descent: LM_HEIGHTS.interstage, ascent: LM_HEIGHTS.overall } }))
  bytes += write(out, 'cockpit', written(nassp.cockpit, COCKPIT_ASSEMBLIES, {}))
  const images: [string, Buffer][] = [[LM_PALETTE_TEXTURE, await lmPalette()], [NASSP_PALETTE_TEXTURE, await nasspPalette(nassp.palette)]]
  for (const [file, path] of nassp.textures) images.push([file, await nasspTexture(file, path)])
  for (const [file, image] of images) {
    writeFileSync(join(out, file), image)
    bytes += image.length
  }
  console.log(`eagle: ${(bytes / 1e6).toFixed(1)} MB with its textures`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await buildEagle(join(dirname(fileURLToPath(import.meta.url)), '../../app/public/models/eagle'))
}
