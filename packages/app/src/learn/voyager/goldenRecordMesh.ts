import { MODEL_VERTEX_FLOATS, type ModelData } from '../../spacecraft/modelFile'
import type { RecordFeature } from './voyagerStage'

// The Golden Record as a disc to turn over: its protective cover (with the engraved instructions)
// on the front (+Z), the record itself on the back, each a photo cropped so the record's rim meets
// the picture's edges (see the data pipeline's voyagerTextures.ts). 12 inches across; metres.
export const RECORD_RADIUS = 0.1524
const THICKNESS = 0.004
const SEGMENTS = 96

export const RECORD_TEXTURES = { cover: 'record-cover.jpg', label: 'record-label.jpg' }

// Where each engraving sits on the cover, as texture coordinates (u right, v down) of the cover photo.
const FEATURE_UV: Record<RecordFeature, [number, number]> = {
  playing: [0.25, 0.3],
  stylus: [0.24, 0.53],
  signal: [0.68, 0.22],
  firstImage: [0.66, 0.6],
  pulsarMap: [0.29, 0.76],
  hydrogen: [0.69, 0.87],
}

// A point on the cover face (record frame, metres) from its texture coordinates.
export function coverPoint([u, v]: [number, number]): [number, number, number] {
  return [(u - 0.5) * 2 * RECORD_RADIUS, (0.5 - v) * 2 * RECORD_RADIUS, THICKNESS / 2]
}

export function featureAnchor(feature: RecordFeature): [number, number, number] {
  return coverPoint(FEATURE_UV[feature])
}

interface Builder {
  vertices: number[]
  indices: number[]
}

function vertex(builder: Builder, position: number[], normal: number[], uv: [number, number]): number {
  builder.vertices.push(...position, ...normal, ...uv, 0)
  return builder.vertices.length / MODEL_VERTEX_FLOATS - 1
}

// A flat face: a fan around the middle. The back face is mirrored so its photo reads unflipped.
function face(builder: Builder, side: 1 | -1): void {
  const z = (side * THICKNESS) / 2
  const center = vertex(builder, [0, 0, z], [0, 0, side], [0.5, 0.5])
  const ring = Array.from({ length: SEGMENTS + 1 }, (_, step) => {
    const angle = (step / SEGMENTS) * 2 * Math.PI
    const [x, y] = [Math.cos(angle), Math.sin(angle)]
    return vertex(builder, [x * RECORD_RADIUS, y * RECORD_RADIUS, z], [0, 0, side], [0.5 + (side * x) / 2, 0.5 - y / 2])
  })
  for (let step = 0; step < SEGMENTS; step++) builder.indices.push(center, ring[step], ring[step + 1])
}

// The rim, colored from the cover photo's edge.
function rim(builder: Builder): void {
  for (let step = 0; step < SEGMENTS; step++) {
    const corners = [step, step + 1].flatMap((index) => {
      const angle = (index / SEGMENTS) * 2 * Math.PI
      const [x, y] = [Math.cos(angle), Math.sin(angle)]
      const uv: [number, number] = [0.5 + x * 0.49, 0.5 - y * 0.49]
      return [-1, 1].map((side) => vertex(builder, [x * RECORD_RADIUS, y * RECORD_RADIUS, (side * THICKNESS) / 2], [x, y, 0], uv))
    })
    builder.indices.push(corners[0], corners[2], corners[1], corners[1], corners[2], corners[3])
  }
}

export function goldenRecordMesh(): ModelData {
  const front: Builder = { vertices: [], indices: [] }
  face(front, 1)
  rim(front)
  const coverIndexCount = front.indices.length
  face(front, -1)
  const vertices = Float32Array.from(front.vertices)
  const indices = Uint16Array.from(front.indices)
  const extent: [number, number, number] = [RECORD_RADIUS, RECORD_RADIUS, THICKNESS / 2]
  return {
    vertices,
    indices,
    description: {
      vertexCount: vertices.length / MODEL_VERTEX_FLOATS,
      indexCount: indices.length,
      indexFormat: 'uint16',
      assemblies: [{ id: 'record', explode: [0, 0, 0] }],
      draws: [
        { texture: RECORD_TEXTURES.cover, firstIndex: 0, indexCount: coverIndexCount },
        { texture: RECORD_TEXTURES.label, firstIndex: coverIndexCount, indexCount: indices.length - coverIndexCount },
      ],
      anchors: {},
      bounds: { min: extent.map((value) => -value) as [number, number, number], max: extent },
    },
  }
}
