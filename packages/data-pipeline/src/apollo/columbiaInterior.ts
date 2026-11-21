import { simplify, weld } from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'
import sharp from 'sharp'
import type { AssemblyKind } from '../../../app/src/spacecraft/modelFile'
import { modelOf, readGlbDocument, type MeshPrimitive } from '../spacecraft/glbMesh'
import { smoothNormals } from '../spacecraft/smoothNormals'
import { CABIN_SCAN, CSM_HEIGHTS } from './csmProfile'

// Columbia's cabin as the Smithsonian scanned it ("Command Module Apollo 11: Interior", 3d.si.edu,
// CC0): its four parts, simplified to fit the app, moved into our command module's frame.

export const CABIN_ASSEMBLIES = ['hull', 'panels', 'seats', 'notes'] as const
export type CabinAssembly = (typeof CABIN_ASSEMBLIES)[number]

// Every part is inside the command module: it shows where the CM is cut open, or all of it from
// within.
export const CABIN_KIND: AssemblyKind = 'inside'

// The scan's parts, by the name of the texture each is painted with, and how large their textures
// are kept (the panels' labels want the detail).
const PARTS: { assembly: CabinAssembly; texture: string; size: number; file: string }[] = [
  { assembly: 'hull', texture: 'x3d-cm-interior-hull-comp-4k_x4096', size: 2048, file: 'cabin-hull.jpg' },
  { assembly: 'panels', texture: 'x3d-cm-interior-panel-comp-4k_x4096', size: 4096, file: 'cabin-panels.jpg' },
  { assembly: 'seats', texture: 'x3d-cm-interior-seats-comp-4k_x4096', size: 2048, file: 'cabin-seats.jpg' },
  { assembly: 'notes', texture: 'x3d-cm-interior-graffiti-comp-2k_x2048', size: 2048, file: 'cabin-notes.jpg' },
]

// About 480k triangles in the scan: kept to about 250k (its many texture seams stop it there),
// moving no surface by more than 0.2 % of the cabin's size (about 5 mm).
const SIMPLIFY = { ratio: 0.3, error: 0.002 }
// Smooth normals over the simplified triangles, sharp past 60 degrees; points within half a
// millimetre are one place.
const SMOOTH = { creaseDegrees: 60, weld: 0.05 }
const JPEG = { quality: 85, mozjpeg: true }

export interface CabinPart {
  assembly: CabinAssembly
  primitive: MeshPrimitive
  textureFile: string
}

export interface Cabin {
  parts: CabinPart[]
  textures: Map<string, Buffer>
}

export async function readCabin(path: string): Promise<Cabin> {
  await MeshoptSimplifier.ready
  const document = await readGlbDocument(path)
  await document.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ...SIMPLIFY }))
  const model = modelOf(document)
  const parts = smoothNormals(model.primitives, SMOOTH).map((primitive) => {
    const part = PARTS.find(({ texture }) => texture === primitive.texture)
    if (!part) throw new Error(`Unknown part of the scan: ${primitive.texture}`)
    return { assembly: part.assembly, primitive: { ...primitive, positions: intoCommandModule(primitive.positions), texture: part.file }, textureFile: part.file }
  })
  const textures = new Map(await Promise.all(PARTS.map(async ({ texture, size, file }) => [file, await resized(model.images.get(texture)!, size)] as const)))
  return { parts, textures }
}

// Centimetres about the scan's own axis to metres in the command module: the axis on ours, the
// cabin floor CABIN_SCAN.floorAboveBase above the bottom of the heat shield.
function intoCommandModule(positions: Float32Array): Float32Array {
  const { centimetre, axis, floor, floorAboveBase } = CABIN_SCAN
  const moved = new Float32Array(positions.length)
  for (let i = 0; i < positions.length; i += 3) {
    moved[i] = (positions[i] - axis[0]) * centimetre
    moved[i + 1] = (positions[i + 1] - floor) * centimetre + CSM_HEIGHTS.cmBase + floorAboveBase
    moved[i + 2] = (positions[i + 2] - axis[1]) * centimetre
  }
  return moved
}

function resized(image: Uint8Array, size: number): Promise<Buffer> {
  return sharp(image).resize(size, size, { fit: 'inside', withoutEnlargement: true }).jpeg(JPEG).toBuffer()
}
