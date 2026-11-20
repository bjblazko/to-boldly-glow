import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ModelDescription } from '../../app/src/spacecraft/modelFile'
import { CABIN_ASSEMBLIES, CABIN_KIND, readCabin, type Cabin, type CabinAssembly } from './apollo/columbiaInterior'
import { CSM_ASSEMBLIES, csmAssemblyKind, csmExplodeOffset, csmPalette, csmParts, CSM_PALETTE_TEXTURE } from './apollo/csmParts'
import { CSM_HEIGHTS } from './apollo/csmProfile'
import type { MeshPrimitive } from './spacecraft/glbMesh'
import { assemblyAnchors, assignAssemblies } from './spacecraft/assemblies'
import { packModel } from './spacecraft/modelWriter'

// Builds Apollo 11's command and service module: the outside from its dimensions
// (apollo/csmProfile.ts), the cabin from the Smithsonian's scan. Writes
// packages/app/public/models/columbia/: csm.* (outside), cabin.* (inside) and their textures.
//
// `npm run build-columbia -- <scan>`, the scan being "Command Module Apollo 11: Interior (medium
// resolution, glb)" from 3d.si.edu, CC0: apollo_interior-medium_resolution.glb (SHA-256
// 0041357eccea177fa28023a97ae400b6f45bddcf635b0ad57840315b71089b50), not committed (40 MB).

function write(out: string, name: string, model: ModelDescription, binary: Buffer): void {
  writeFileSync(join(out, `${name}.bin`), binary)
  writeFileSync(join(out, `${name}.json`), JSON.stringify(model, null, 1) + '\n')
  console.log(`${name}: ${model.vertexCount} vertices, ${model.indexCount / 3} triangles, ${(binary.length / 1e6).toFixed(1)} MB`)
}

function outside(): { model: ModelDescription; binary: Buffer } {
  const parts = csmParts()
  const { binary, description } = packModel(assignAssemblies(parts, CSM_ASSEMBLIES))
  const assemblies = CSM_ASSEMBLIES.map((id) => ({ id, explode: csmExplodeOffset(id), kind: csmAssemblyKind(id) }))
  const marks = { sm: CSM_HEIGHTS.smTop, cm: CSM_HEIGHTS.cmTop }
  return { model: { ...description, assemblies, anchors: assemblyAnchors(parts, (assembly) => assembly !== 'person' && assembly !== 'antenna'), marks }, binary }
}

function inside(cabin: Cabin): { model: ModelDescription; binary: Buffer } {
  const parts = new Map<CabinAssembly, MeshPrimitive[]>(CABIN_ASSEMBLIES.map((assembly) => [assembly, cabin.parts.filter((part) => part.assembly === assembly).map((part) => part.primitive)]))
  const { binary, description } = packModel(assignAssemblies(parts, CABIN_ASSEMBLIES))
  // The cabin rises with the command module when the two modules are taken apart; the scan is seen
  // from inside only.
  const assemblies = CABIN_ASSEMBLIES.map((id) => ({ id, explode: csmExplodeOffset('cm'), kind: CABIN_KIND }))
  return { model: { ...description, assemblies, anchors: assemblyAnchors(parts, () => false), oneSided: true }, binary }
}

export async function buildColumbia(out: string, scan: string): Promise<void> {
  mkdirSync(out, { recursive: true })
  const csm = outside()
  write(out, 'csm', csm.model, csm.binary)
  writeFileSync(join(out, CSM_PALETTE_TEXTURE), await csmPalette())
  const cabin = await readCabin(scan)
  const built = inside(cabin)
  write(out, 'cabin', built.model, built.binary)
  for (const [file, image] of cabin.textures) writeFileSync(join(out, file), image)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [scan] = process.argv.slice(2)
  if (!scan) throw new Error('usage: build-columbia <apollo_interior-medium_resolution.glb>')
  await buildColumbia(join(dirname(fileURLToPath(import.meta.url)), '../../app/public/models/columbia'), scan)
}
