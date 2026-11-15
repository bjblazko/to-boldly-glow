// A spacecraft model as the data pipeline writes it (packages/data-pipeline/src/convertVoyager.ts):
// `<name>.json` describes `<name>.bin`, which holds the vertices - interleaved float32 position
// (metres), normal, texture coordinate and assembly index - followed by the triangle indices.

export const MODEL_VERTEX_FLOATS = 9

export interface ModelDescription {
  vertexCount: number
  indexCount: number
  indexFormat: 'uint16' | 'uint32'
  // The parts it can be taken apart into, in the order the vertices' assembly index counts them,
  // with how far each moves out in the exploded view (metres).
  assemblies: { id: string; explode: [number, number, number] }[]
  // One draw per texture: a run of the index list and the image (next to the .json) it samples.
  draws: { texture: string; firstIndex: number; indexCount: number }[]
  // The points the lesson's labels point at, by name (metres, in the model's frame).
  anchors: Record<string, [number, number, number]>
  bounds: { min: [number, number, number]; max: [number, number, number] }
}

export interface ModelData {
  description: ModelDescription
  vertices: Float32Array
  indices: Uint16Array | Uint32Array
}

// Splits a model's .bin into its vertex and index arrays.
export function readModelBinary(description: ModelDescription, binary: ArrayBuffer): ModelData {
  const vertexFloats = description.vertexCount * MODEL_VERTEX_FLOATS
  const vertices = new Float32Array(binary, 0, vertexFloats)
  const IndexArray = description.indexFormat === 'uint16' ? Uint16Array : Uint32Array
  const indices = new IndexArray(binary, vertexFloats * 4, description.indexCount)
  return { description, vertices, indices }
}

export async function loadModel(baseUrl: string): Promise<ModelData> {
  const [description, binary] = await Promise.all([
    fetch(`${baseUrl}.json`).then((response) => response.json() as Promise<ModelDescription>),
    fetch(`${baseUrl}.bin`).then((response) => response.arrayBuffer()),
  ])
  return readModelBinary(description, binary)
}
