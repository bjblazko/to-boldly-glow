import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cmCockpit } from './apollo/csmNasspModel'
import { csmExplodeOffset } from './apollo/csmParts'
import { nasspPalette, nasspTexture } from './apollo/nasspParts'
import { assemblyAnchors, assignAssemblies } from './spacecraft/assemblies'
import { packModel } from './spacecraft/modelWriter'

// Builds Columbia's cockpit as it flew, from Project Apollo - NASSP's meshes and textures
// (GPL-2.0-or-later, apollo/nassp.ts, at a pinned commit): packages/app/public/models/columbia/
// cockpit.* and nassp/. The cabin as it is today stays the Smithsonian's scan (buildColumbia.ts).
//
// `npm run build-columbia-cockpit`

export const COCKPIT_ASSEMBLIES = ['vcCabin', 'vcPanels', 'vcHatches', 'vcCouches'] as const

export async function buildColumbiaCockpit(out: string): Promise<void> {
  mkdirSync(join(out, 'nassp'), { recursive: true })
  const cockpit = await cmCockpit()
  const { binary, description } = packModel(assignAssemblies(cockpit.parts, COCKPIT_ASSEMBLIES))
  // It rises with the command module when the two modules are taken apart; it is seen from inside.
  const assemblies = COCKPIT_ASSEMBLIES.map((id) => ({ id, explode: csmExplodeOffset('cm'), kind: 'inside' as const }))
  const model = { ...description, assemblies, anchors: assemblyAnchors(cockpit.parts, () => false) }
  writeFileSync(join(out, 'cockpit.bin'), binary)
  writeFileSync(join(out, 'cockpit.json'), JSON.stringify(model, null, 1) + '\n')
  let bytes = binary.length
  const images: [string, Buffer][] = [['nassp/palette.png', await nasspPalette(cockpit.palette)]]
  for (const [file, path] of cockpit.textures) images.push([file, await nasspTexture(file, path)])
  for (const [file, image] of images) {
    writeFileSync(join(out, file), image)
    bytes += image.length
  }
  console.log(`cockpit: ${description.vertexCount} vertices, ${description.indexCount / 3} triangles; ${(bytes / 1e6).toFixed(1)} MB with its textures`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await buildColumbiaCockpit(join(dirname(fileURLToPath(import.meta.url)), '../../app/public/models/columbia'))
}
