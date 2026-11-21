import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ModelDescription } from '../../app/src/spacecraft/modelFile'
import { assemblyKind, explodeOffset, PAINT_TEXTURE, PALETTE_TEXTURE, SATURN_V_ASSEMBLIES, saturnVParts } from './apollo/saturnVParts'
import { paintTexture, saturnVPalette } from './apollo/saturnVTextures'
import { HEIGHTS, TOTAL_HEIGHT } from './apollo/saturnVProfile'
import { assemblyAnchors, assignAssemblies } from './spacecraft/assemblies'
import { packModel } from './spacecraft/modelWriter'

// Builds Apollo 11's Saturn V from its dimensions (apollo/saturnVProfile.ts) into the app's model
// format, taken apart into its assemblies, with its paint and palette textures. Nothing is
// downloaded. Writes packages/app/public/models/saturnV/.
//
// `npm run build-saturn-v`

export async function buildSaturnV(out: string): Promise<ModelDescription> {
  const parts = saturnVParts()
  const { binary, description } = packModel(assignAssemblies(parts, SATURN_V_ASSEMBLIES))
  const assemblies = SATURN_V_ASSEMBLIES.map((id) => ({ id, explode: explodeOffset(id), kind: assemblyKind(id) }))
  const marks = { sic: HEIGHTS.sicTop, sii: HEIGHTS.siiTop, sivb: HEIGHTS.sivbTop, top: TOTAL_HEIGHT }
  const model: ModelDescription = { ...description, assemblies, anchors: assemblyAnchors(parts, (assembly) => assembly !== 'person'), marks }
  mkdirSync(out, { recursive: true })
  writeFileSync(join(out, 'saturnV.bin'), binary)
  writeFileSync(join(out, 'saturnV.json'), JSON.stringify(model, null, 1) + '\n')
  writeFileSync(join(out, PAINT_TEXTURE), await paintTexture())
  writeFileSync(join(out, PALETTE_TEXTURE), await saturnVPalette())
  console.log(`Wrote ${description.vertexCount} vertices, ${description.indexCount / 3} triangles to ${out}`)
  return model
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await buildSaturnV(join(dirname(fileURLToPath(import.meta.url)), '../../app/public/models/saturnV'))
}
