import type { SphereMesh } from '../geometry/sphere'
import { litSphereShaderCode } from './shaders'

export interface GpuContext {
  device: GPUDevice
  context: GPUCanvasContext
  format: GPUTextureFormat
  depthTexture: GPUTexture
}

export async function initWebGpu(canvas: HTMLCanvasElement): Promise<GpuContext> {
  if (!navigator.gpu) {
    throw new Error('WebGPU is not supported in this browser.')
  }
  const adapter = await navigator.gpu.requestAdapter()
  if (!adapter) {
    throw new Error('No WebGPU adapter available.')
  }
  const device = await adapter.requestDevice()

  const context = canvas.getContext('webgpu')
  if (!context) {
    throw new Error('Failed to get a WebGPU canvas context.')
  }
  const format = navigator.gpu.getPreferredCanvasFormat()
  context.configure({ device, format })

  const depthTexture = device.createTexture({
    size: [canvas.width, canvas.height],
    format: 'depth24plus',
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  })

  return { device, context, format, depthTexture }
}

const POSITION_BUFFER_LAYOUT: GPUVertexBufferLayout = {
  arrayStride: 3 * 4,
  attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }],
}

const NORMAL_BUFFER_LAYOUT: GPUVertexBufferLayout = {
  arrayStride: 3 * 4,
  attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x3' }],
}

export function createLitPipeline(device: GPUDevice, format: GPUTextureFormat): GPURenderPipeline {
  const module = device.createShaderModule({ label: 'lit sphere shader', code: litSphereShaderCode })
  return device.createRenderPipeline({
    label: 'lit sphere pipeline',
    layout: 'auto',
    vertex: { module, entryPoint: 'vs', buffers: [POSITION_BUFFER_LAYOUT, NORMAL_BUFFER_LAYOUT] },
    fragment: { module, entryPoint: 'fs', targets: [{ format }] },
    // DEVIATION from brief: added `frontFace: 'cw'`. The brief's pipeline code omitted `frontFace`,
    // which defaults to WebGPU's 'ccw'. generateSphereMesh (Task 1)'s index order
    // (first, second, first+1 / second, second+1, first+1) is consistently clockwise as viewed
    // from outside the sphere (verified numerically: cross(p1-p0, p2-p0) dotted with the vertex's
    // own outward normal is negative for every triangle sampled). With the default 'ccw' front
    // face and cullMode: 'back', WebGPU culled the camera-facing hemisphere and rendered the
    // inside of the far hemisphere instead — visible as a mostly-black sphere with only a thin
    // lit rim (the far hemisphere's own grazing edge), instead of a normally-lit near hemisphere.
    // Declaring frontFace: 'cw' matches the mesh's actual winding and keeps cullMode: 'back'
    // culling the true back faces.
    primitive: { topology: 'triangle-list', cullMode: 'back', frontFace: 'cw' },
    depthStencil: { depthWriteEnabled: true, depthCompare: 'less', format: 'depth24plus' },
  })
}

export interface MeshBuffers {
  positionBuffer: GPUBuffer
  normalBuffer: GPUBuffer
  indexBuffer: GPUBuffer
  indexCount: number
}

// The `as BufferSource` casts below are type-only: @webgpu/types' writeBuffer signature expects
// ArrayBufferView<ArrayBuffer>, but TypeScript 5.9's DOM lib made typed arrays generic over their
// backing buffer type, so SphereMesh's unparameterized Float32Array/Uint32Array (ArrayBufferLike)
// no longer structurally matches. No change to the data actually written at runtime.
export function createMeshBuffers(device: GPUDevice, mesh: SphereMesh): MeshBuffers {
  const positionBuffer = device.createBuffer({
    label: 'sphere positions',
    size: mesh.positions.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  })
  device.queue.writeBuffer(positionBuffer, 0, mesh.positions as BufferSource)

  const normalBuffer = device.createBuffer({
    label: 'sphere normals',
    size: mesh.normals.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  })
  device.queue.writeBuffer(normalBuffer, 0, mesh.normals as BufferSource)

  const indexBuffer = device.createBuffer({
    label: 'sphere indices',
    size: mesh.indices.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  })
  device.queue.writeBuffer(indexBuffer, 0, mesh.indices as BufferSource)

  return { positionBuffer, normalBuffer, indexBuffer, indexCount: mesh.indices.length }
}
