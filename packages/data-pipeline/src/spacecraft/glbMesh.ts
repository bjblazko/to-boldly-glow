import { NodeIO, type Node, type Primitive } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import draco3d from 'draco3dgltf'

// One textured triangle list of a glTF model, in the model's own frame: the node transforms are
// applied, so every primitive shares one coordinate system.
export interface MeshPrimitive {
  // Which of the model's textures colors it (its file name inside the glTF).
  texture: string
  positions: Float32Array
  normals: Float32Array
  uvs: Float32Array
  indices: Uint32Array
}

export interface GlbModel {
  primitives: MeshPrimitive[]
  // Each texture's image, as stored (PNG or WebP), by name.
  images: Map<string, Uint8Array>
}

// Reads a .glb file, Draco-compressed or not. Primitives without a base-color texture (helper
// geometry such as an exporter's placeholder cube) are left out.
export async function readGlb(path: string): Promise<GlbModel> {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() })
  const root = (await io.read(path)).getRoot()
  const primitives = root.listNodes().flatMap((node) => nodePrimitives(node))
  const images = new Map<string, Uint8Array>()
  // A texture may come twice (WebP and a PNG fallback); the PNG is kept, as it decodes everywhere.
  for (const texture of root.listTextures()) {
    const image = texture.getImage()
    if (image && (!images.has(texture.getName()) || texture.getMimeType() === 'image/png')) images.set(texture.getName(), image)
  }
  return { primitives, images }
}

function nodePrimitives(node: Node): MeshPrimitive[] {
  const mesh = node.getMesh()
  if (!mesh) return []
  const matrix = node.getWorldMatrix()
  return mesh.listPrimitives().flatMap((primitive) => {
    const texture = primitive.getMaterial()?.getBaseColorTexture()?.getName()
    return texture ? [transformedPrimitive(primitive, texture, matrix)] : []
  })
}

function transformedPrimitive(primitive: Primitive, texture: string, matrix: ArrayLike<number>): MeshPrimitive {
  const read = (semantic: string) => Float32Array.from(primitive.getAttribute(semantic)?.getArray() ?? [])
  const positions = read('POSITION')
  const normals = read('NORMAL')
  const indices = Uint32Array.from(primitive.getIndices()?.getArray() ?? positions.map((_, index) => index).slice(0, positions.length / 3))
  transformPoints(positions, matrix, 1)
  transformPoints(normals, matrix, 0)
  normalizeVectors(normals)
  return { texture, positions, normals, uvs: read('TEXCOORD_0'), indices }
}

// Applies a column-major 4x4 matrix to packed xyz triples: w = 1 for points, 0 for directions.
export function transformPoints(values: Float32Array, m: ArrayLike<number>, w: number): void {
  for (let i = 0; i < values.length; i += 3) {
    const [x, y, z] = [values[i], values[i + 1], values[i + 2]]
    values[i] = m[0] * x + m[4] * y + m[8] * z + m[12] * w
    values[i + 1] = m[1] * x + m[5] * y + m[9] * z + m[13] * w
    values[i + 2] = m[2] * x + m[6] * y + m[10] * z + m[14] * w
  }
}

function normalizeVectors(values: Float32Array): void {
  for (let i = 0; i < values.length; i += 3) {
    const length = Math.hypot(values[i], values[i + 1], values[i + 2]) || 1
    values[i] /= length
    values[i + 1] /= length
    values[i + 2] /= length
  }
}
