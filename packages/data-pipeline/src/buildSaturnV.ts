import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ModelDescription } from '../../app/src/spacecraft/modelFile'
import { assemblyKind, explodeOffset, PAINT_TEXTURE, PALETTE_TEXTURE, SATURN_V_ASSEMBLIES, saturnVParts, type SaturnVAssembly } from './apollo/saturnVParts'
import { paintTexture, paletteTexture } from './apollo/saturnVTextures'
import { HEIGHTS, TOTAL_HEIGHT } from './apollo/saturnVProfile'
import type { MeshPrimitive } from './spacecraft/glbMesh'
import { packModel, type AssignedPrimitive } from './spacecraft/modelWriter'

// Builds Apollo 11's Saturn V from its dimensions (apollo/saturnVProfile.ts) into the app's model
// format, taken apart into its assemblies, with its paint and palette textures. Nothing is
// downloaded. Writes packages/app/public/models/saturnV/.
//
// `npm run build-saturn-v`

function assign(parts: Map<SaturnVAssembly, MeshPrimitive[]>): AssignedPrimitive[] {
  return [...parts].flatMap(([assembly, primitives]) =>
    primitives.map((primitive) => ({
      primitive,
      vertexAssembly: new Uint8Array(primitive.positions.length / 3).fill(SATURN_V_ASSEMBLIES.indexOf(assembly)),
      textureFile: primitive.texture,
    })),
  )
}

// A label points at the middle of its assembly, on the axis: always inside the part, whichever
// way the rocket has turned.
function anchors(parts: Map<SaturnVAssembly, MeshPrimitive[]>): ModelDescription['anchors'] {
  return Object.fromEntries(
    [...parts].map(([assembly, primitives]) => {
      const heights = primitives.flatMap((primitive) => [...primitive.positions].filter((_, index) => index % 3 === 1))
      const [x, z] = assembly === 'person' ? [primitives[0].positions[0], primitives[0].positions[2]] : [0, 0]
      return [assembly, [x, (Math.min(...heights) + Math.max(...heights)) / 2, z]]
    }),
  )
}

export async function buildSaturnV(out: string): Promise<ModelDescription> {
  const parts = saturnVParts()
  const { binary, description } = packModel(assign(parts))
  const assemblies = SATURN_V_ASSEMBLIES.map((id) => ({ id, explode: explodeOffset(id), kind: assemblyKind(id) }))
  const marks = { sic: HEIGHTS.sicTop, sii: HEIGHTS.siiTop, sivb: HEIGHTS.sivbTop, top: TOTAL_HEIGHT }
  const model: ModelDescription = { ...description, assemblies, anchors: anchors(parts), marks }
  mkdirSync(out, { recursive: true })
  writeFileSync(join(out, 'saturnV.bin'), binary)
  writeFileSync(join(out, 'saturnV.json'), JSON.stringify(model, null, 1) + '\n')
  writeFileSync(join(out, PAINT_TEXTURE), await paintTexture())
  writeFileSync(join(out, PALETTE_TEXTURE), await paletteTexture())
  console.log(`Wrote ${description.vertexCount} vertices, ${description.indexCount / 3} triangles to ${out}`)
  return model
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await buildSaturnV(join(dirname(fileURLToPath(import.meta.url)), '../../app/public/models/saturnV'))
}
