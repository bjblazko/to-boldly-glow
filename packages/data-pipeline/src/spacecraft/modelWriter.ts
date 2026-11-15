import { MODEL_VERTEX_FLOATS, type ModelDescription } from '../../../app/src/spacecraft/modelFile'
import type { MeshPrimitive } from './glbMesh'

// A primitive with each vertex's assembly (its index into the model's assembly list).
export interface AssignedPrimitive {
  primitive: MeshPrimitive
  vertexAssembly: Uint8Array
  // The image file the app loads for this primitive's texture.
  textureFile: string
}

export interface PackedModel {
  binary: Buffer
  description: Omit<ModelDescription, 'assemblies' | 'anchors'>
}

// Interleaves every primitive's vertices into one buffer and appends their indices, one draw per
// texture file (primitives sharing a texture are merged into one run).
export function packModel(parts: AssignedPrimitive[]): PackedModel {
  const vertexCount = parts.reduce((sum, { primitive }) => sum + primitive.positions.length / 3, 0)
  const vertices = new Float32Array(vertexCount * MODEL_VERTEX_FLOATS)
  const runs = new Map<string, number[]>()
  let base = 0
  for (const part of parts) {
    writeVertices(vertices, base, part)
    const run = runs.get(part.textureFile) ?? []
    for (const index of part.primitive.indices) run.push(base + index)
    runs.set(part.textureFile, run)
    base += part.primitive.positions.length / 3
  }
  const allIndices = [...runs.values()].flat()
  const indexFormat = vertexCount < 65536 ? 'uint16' : 'uint32'
  const indices = indexFormat === 'uint16' ? Uint16Array.from(allIndices) : Uint32Array.from(allIndices)
  return {
    binary: Buffer.concat([Buffer.from(vertices.buffer), Buffer.from(indices.buffer)]),
    description: { vertexCount, indexCount: indices.length, indexFormat, draws: draws(runs), bounds: bounds(vertices) },
  }
}

function writeVertices(target: Float32Array, base: number, { primitive, vertexAssembly }: AssignedPrimitive): void {
  const { positions, normals, uvs } = primitive
  for (let vertex = 0; vertex < positions.length / 3; vertex++) {
    const offset = (base + vertex) * MODEL_VERTEX_FLOATS
    target.set(positions.subarray(vertex * 3, vertex * 3 + 3), offset)
    target.set(normals.subarray(vertex * 3, vertex * 3 + 3), offset + 3)
    target.set(uvs.subarray(vertex * 2, vertex * 2 + 2), offset + 6)
    target[offset + 8] = vertexAssembly[vertex]
  }
}

function draws(runs: Map<string, number[]>): ModelDescription['draws'] {
  let firstIndex = 0
  return [...runs].map(([texture, run]) => {
    const draw = { texture, firstIndex, indexCount: run.length }
    firstIndex += run.length
    return draw
  })
}

function bounds(vertices: Float32Array): ModelDescription['bounds'] {
  const min: [number, number, number] = [Infinity, Infinity, Infinity]
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (let offset = 0; offset < vertices.length; offset += MODEL_VERTEX_FLOATS) {
    for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis], vertices[offset + axis])
      max[axis] = Math.max(max[axis], vertices[offset + axis])
    }
  }
  return { min, max }
}
