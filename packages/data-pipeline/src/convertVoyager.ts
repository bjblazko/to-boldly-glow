import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ModelDescription } from '../../app/src/spacecraft/modelFile'
import { readGlb, type MeshPrimitive } from './spacecraft/glbMesh'
import { meshPieces, type MeshPiece } from './spacecraft/meshParts'
import { packModel, type AssignedPrimitive } from './spacecraft/modelWriter'
import { assemblyOf, EXPLODE_OFFSETS, labelAnchor, recordExplodeOffset, VOYAGER_ASSEMBLIES, type AssemblyBox, type VoyagerAssembly } from './spacecraft/voyagerAssemblies'
import { colorTexture, greyTexture, recordTexture } from './spacecraft/voyagerTextures'

// Converts NASA's Voyager model (data/voyager/voyager.glb: "Voyager Probe (B).glb" from
// github.com/nasa/NASA-3D-Resources, 3D Models/Voyager Probe (B), SHA-256 bd86ded8...c3289) into
// the app's model format, taken apart into its assemblies, and crops NASA's photos of the Golden
// Record into the record's two textures. Writes packages/app/public/models/voyager/.
//
// `npm run convert-voyager -- <cover photo> <label photo>`, the photos from Wikimedia Commons
// (NASA/JPL, public domain):
//   The_Sounds_of_Earth_Record_Cover_-_GPN-2000-001978.jpg (SHA-256 89f8666e...6055cff)
//   The_Sounds_of_Earth_-_GPN-2000-001976.jpg (SHA-256 d4a2750d...b8344952)

const TEXTURE_FILES: Record<string, { file: string; convert: (image: Uint8Array) => Promise<Buffer> }> = {
  'Voyager_tex_01.ps': { file: 'voyager-color.jpg', convert: colorTexture },
  'tex_02_AO.png': { file: 'voyager-grey.jpg', convert: greyTexture },
}

interface Classified {
  assigned: AssignedPrimitive[]
  boxes: Map<VoyagerAssembly, AssemblyBox>
}

function classify(primitives: MeshPrimitive[]): Classified {
  const boxes = new Map<VoyagerAssembly, AssemblyBox>()
  const assigned = primitives.map((primitive) => {
    const vertexAssembly = new Uint8Array(primitive.positions.length / 3)
    for (const piece of meshPieces(primitive.positions, primitive.indices, primitive.uvs)) {
      const assembly = assemblyOf(piece, primitive.texture)
      growBox(boxes, assembly, piece)
      for (const triangle of piece.triangles) for (let corner = 0; corner < 3; corner++) vertexAssembly[primitive.indices[triangle * 3 + corner]] = VOYAGER_ASSEMBLIES.indexOf(assembly)
    }
    return { primitive, vertexAssembly, textureFile: TEXTURE_FILES[primitive.texture].file }
  })
  return { assigned, boxes }
}

function growBox(boxes: Map<VoyagerAssembly, AssemblyBox>, assembly: VoyagerAssembly, piece: MeshPiece): void {
  const box = boxes.get(assembly) ?? { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }
  for (let axis = 0; axis < 3; axis++) {
    box.min[axis] = Math.min(box.min[axis], piece.min[axis])
    box.max[axis] = Math.max(box.max[axis], piece.max[axis])
  }
  boxes.set(assembly, box)
}

function describeAssemblies(boxes: Map<VoyagerAssembly, AssemblyBox>): Pick<ModelDescription, 'assemblies' | 'anchors'> {
  const anchors = Object.fromEntries(VOYAGER_ASSEMBLIES.map((assembly) => [assembly, labelAnchor(assembly, boxes.get(assembly)!)]))
  const assemblies = VOYAGER_ASSEMBLIES.map((id) => ({ id, explode: id === 'record' ? recordExplodeOffset(anchors.record) : EXPLODE_OFFSETS[id] }))
  return { assemblies, anchors }
}

async function convert(out: string, [coverPhoto, labelPhoto]: string[]): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url))
  const model = await readGlb(join(here, '../data/voyager/voyager.glb'))
  const { assigned, boxes } = classify(model.primitives)
  const { binary, description } = packModel(assigned)
  mkdirSync(out, { recursive: true })
  writeFileSync(join(out, 'voyager.bin'), binary)
  writeFileSync(join(out, 'voyager.json'), JSON.stringify({ ...description, ...describeAssemblies(boxes) }, null, 1) + '\n')
  for (const [name, { file, convert }] of Object.entries(TEXTURE_FILES)) writeFileSync(join(out, file), await convert(model.images.get(name)!))
  writeFileSync(join(out, 'record-cover.jpg'), await recordTexture(readFileSync(coverPhoto)))
  writeFileSync(join(out, 'record-label.jpg'), await recordTexture(readFileSync(labelPhoto)))
  console.log(`Wrote ${description.vertexCount} vertices, ${description.indexCount / 3} triangles to ${out}`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const photos = process.argv.slice(2)
  if (photos.length !== 2) throw new Error('usage: convert-voyager <record cover photo> <record label photo>')
  await convert(join(dirname(fileURLToPath(import.meta.url)), '../../app/public/models/voyager'), photos)
}
