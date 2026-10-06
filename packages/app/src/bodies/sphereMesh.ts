import { createVertexBuffer } from '../gpu/buffers'

export interface SphereMesh {
  positions: Float32Array
  normals: Float32Array
  uvs: Float32Array
  indices: Uint32Array
}

// Generates a UV sphere: latSegments bands from pole to pole, lonSegments bands around each
// latitude circle. A unit sphere's outward normal at any point equals that point's position
// divided by its radius, so positions and normals share the same generation loop.
// The mesh's polar axis is local +Z (theta=0 sits at local +Z, full radius) — this matches
// solarSystem/poleOrientation.ts's axisAlignmentRotation, which maps local +Z onto each body's
// real pole, and the spin rotation (mat4.fromZRotation) applied around local Z.
export function generateSphereMesh(radius: number, latSegments: number, lonSegments: number): SphereMesh {
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  for (let lat = 0; lat <= latSegments; lat++) {
    for (let lon = 0; lon <= lonSegments; lon++) {
      const normal = sphereNormal((lat * Math.PI) / latSegments, (lon * 2 * Math.PI) / lonSegments)
      positions.push(radius * normal[0], radius * normal[1], radius * normal[2])
      normals.push(...normal)
      // Equirectangular mapping, the layout of the planet texture maps: v runs from the north pole
      // (v=0, local +Z) to the south pole, u around the longitude, its seam closed by duplicate
      // vertices at lon=0 and lon=lonSegments. u runs opposite to phi: phi turns clockwise seen
      // from above the north pole, but a map's east must turn counterclockwise - the sense every
      // body spins in - or every texture shows as its own mirror image. u=0.5, the map's central
      // meridian, lands on local -Y.
      uvs.push(1 - lon / lonSegments, lat / latSegments)
    }
  }
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: gridTriangleIndices(latSegments, lonSegments),
  }
}

// The unit normal at angle theta from the north pole and phi around the polar axis.
function sphereNormal(theta: number, phi: number): [number, number, number] {
  return [Math.sin(phi) * Math.sin(theta), Math.cos(phi) * Math.sin(theta), Math.cos(theta)]
}

// Two triangles per grid cell of a (rows + 1) x (columns + 1) vertex grid.
function gridTriangleIndices(rows: number, columns: number): Uint32Array {
  const indices: number[] = []
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const first = row * (columns + 1) + column
      const second = first + columns + 1
      indices.push(first, second, first + 1, second, second + 1, first + 1)
    }
  }
  return new Uint32Array(indices)
}

// Position, normal and uv each live in their own vertex buffer (shader locations 0, 1, 2).
export const SPHERE_VERTEX_BUFFERS: GPUVertexBufferLayout[] = [
  { arrayStride: 3 * 4, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] },
  { arrayStride: 3 * 4, attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x3' }] },
  { arrayStride: 2 * 4, attributes: [{ shaderLocation: 2, offset: 0, format: 'float32x2' }] },
]

export interface SphereMeshBuffers {
  vertexBuffers: GPUBuffer[]
  indexBuffer: GPUBuffer
  indexCount: number
}

// Segments per axis of the shared sphere: enough for a round silhouette even on a close-up.
export const SPHERE_SEGMENTS = 64

// One unit sphere shared by every body (and every atmosphere shell): each draw scales it.
export function createSphereMeshBuffers(device: GPUDevice, mesh = generateSphereMesh(1, SPHERE_SEGMENTS, SPHERE_SEGMENTS)): SphereMeshBuffers {
  return {
    vertexBuffers: [
      createVertexBuffer(device, 'sphere positions', mesh.positions),
      createVertexBuffer(device, 'sphere normals', mesh.normals),
      createVertexBuffer(device, 'sphere uvs', mesh.uvs),
    ],
    indexBuffer: createVertexBuffer(device, 'sphere indices', mesh.indices, GPUBufferUsage.INDEX),
    indexCount: mesh.indices.length,
  }
}

// Expects a sphere pipeline to be set on the pass.
export function drawSphere(pass: GPURenderPassEncoder, mesh: SphereMeshBuffers, bindGroup: GPUBindGroup): void {
  mesh.vertexBuffers.forEach((buffer, slot) => pass.setVertexBuffer(slot, buffer))
  pass.setIndexBuffer(mesh.indexBuffer, 'uint32')
  pass.setBindGroup(0, bindGroup)
  pass.drawIndexed(mesh.indexCount)
}
