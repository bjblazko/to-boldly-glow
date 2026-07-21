import type { RingMesh } from '../geometry/ring'
import type { SphereMesh } from '../geometry/sphere'
import {
  cloudShellShaderCode,
  flareShaderCode,
  lineShaderCode,
  litSphereShaderCode,
  ringShaderCode,
  starShaderCode,
  unlitSphereShaderCode,
} from './shaders'

export const SAMPLE_COUNT = 4

export interface GpuContext {
  device: GPUDevice
  context: GPUCanvasContext
  format: GPUTextureFormat
}

export interface RenderTargets {
  depthTexture: GPUTexture
  multisampleColorTexture: GPUTexture
}

// The depth and MSAA color textures are fixed-size GPU resources tied to the canvas's current
// backing-store dimensions — unlike the canvas's own swap-chain texture (from
// `context.getCurrentTexture()`), which WebGPU resizes automatically to track `canvas.width`/
// `canvas.height`. Callers must recreate these (and destroy the old ones) whenever the canvas is
// resized; see `resizeCanvasIfNeeded` in main.ts.
export function createRenderTargets(
  device: GPUDevice,
  format: GPUTextureFormat,
  width: number,
  height: number,
): RenderTargets {
  const depthTexture = device.createTexture({
    size: [width, height],
    format: 'depth24plus',
    sampleCount: SAMPLE_COUNT,
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  })

  const multisampleColorTexture = device.createTexture({
    size: [width, height],
    format,
    sampleCount: SAMPLE_COUNT,
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  })

  return { depthTexture, multisampleColorTexture }
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

  // WebGPU validation errors raised during command encoding/submission (e.g. a pipeline whose
  // multisample count doesn't match its render pass's attachments) are reported asynchronously
  // as GPUUncapturedErrorEvents, not as thrown/catchable exceptions — createRenderPipelineAsync's
  // rejection only covers pipeline-*creation*-time errors (like shader compile failures), not
  // this class of per-draw validation error. Without this listener such errors are silently
  // logged to the console and the invalid command buffer is dropped, while frame() keeps running
  // and rendering looks fine — masking real bugs both from users and from the e2e test's
  // `pageerror` check. Re-throwing surfaces it as an uncaught exception, which both browsers and
  // Playwright's `page.on('pageerror')` treat the same as any other runtime error.
  device.addEventListener('uncapturederror', (event) => {
    throw (event as GPUUncapturedErrorEvent).error
  })

  const context = canvas.getContext('webgpu')
  if (!context) {
    throw new Error('Failed to get a WebGPU canvas context.')
  }
  const format = navigator.gpu.getPreferredCanvasFormat()
  context.configure({ device, format })

  return { device, context, format }
}

const POSITION_BUFFER_LAYOUT: GPUVertexBufferLayout = {
  arrayStride: 3 * 4,
  attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }],
}

const NORMAL_BUFFER_LAYOUT: GPUVertexBufferLayout = {
  arrayStride: 3 * 4,
  attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x3' }],
}

const UV_BUFFER_LAYOUT: GPUVertexBufferLayout = {
  arrayStride: 2 * 4,
  attributes: [{ shaderLocation: 2, offset: 0, format: 'float32x2' }],
}

export function createBodySampler(device: GPUDevice): GPUSampler {
  // U (longitude) wraps around the sphere seam; V (latitude) must not wrap at the poles.
  // mipmapFilter requires body textures to actually carry a mip chain (see textureLoader.ts's
  // generateMipmaps call) — without one, WebGPU still accepts this but there's nothing to
  // interpolate between. maxAnisotropy sharpens grazing-angle views (e.g. ring edges, planets near
  // the horizon) once mips exist; 16 is the conventional safe ceiling most implementations clamp
  // to — WebGPU exposes no queryable upper bound for this via GPUSupportedLimits, unlike most other
  // limits, so this is worth reverifying empirically on target browsers rather than assuming.
  return device.createSampler({
    label: 'body texture sampler',
    magFilter: 'linear',
    minFilter: 'linear',
    mipmapFilter: 'linear',
    maxAnisotropy: 16,
    addressModeU: 'repeat',
    addressModeV: 'clamp-to-edge',
  })
}

export async function createLitPipeline(device: GPUDevice, format: GPUTextureFormat): Promise<GPURenderPipeline> {
  const module = device.createShaderModule({ label: 'lit sphere shader', code: litSphereShaderCode })
  return await device.createRenderPipelineAsync({
    label: 'lit sphere pipeline',
    layout: 'auto',
    vertex: { module, entryPoint: 'vs', buffers: [POSITION_BUFFER_LAYOUT, NORMAL_BUFFER_LAYOUT, UV_BUFFER_LAYOUT] },
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
    multisample: { count: SAMPLE_COUNT },
  })
}

export async function createUnlitPipeline(
  device: GPUDevice,
  format: GPUTextureFormat,
): Promise<GPURenderPipeline> {
  const module = device.createShaderModule({ label: 'unlit sphere shader', code: unlitSphereShaderCode })
  return await device.createRenderPipelineAsync({
    label: 'unlit sphere pipeline',
    layout: 'auto',
    vertex: { module, entryPoint: 'vs', buffers: [POSITION_BUFFER_LAYOUT, NORMAL_BUFFER_LAYOUT, UV_BUFFER_LAYOUT] },
    fragment: { module, entryPoint: 'fs', targets: [{ format }] },
    // DEVIATION from brief carried forward from createLitPipeline: added `frontFace: 'cw'`. Same
    // root cause as documented above — generateSphereMesh (Task 1)'s winding is clockwise as
    // viewed from outside, opposite WebGPU's default 'ccw' front face. This pipeline draws the
    // same sphere mesh with cullMode: 'back', so without this fix it would hit the identical bug
    // (hollow/inverted sphere). Not a new diagnosis, just applying the already-approved fix to a
    // second pipeline that shares the mesh.
    primitive: { topology: 'triangle-list', cullMode: 'back', frontFace: 'cw' },
    depthStencil: { depthWriteEnabled: true, depthCompare: 'less', format: 'depth24plus' },
    multisample: { count: SAMPLE_COUNT },
  })
}

export interface MeshBuffers {
  positionBuffer: GPUBuffer
  normalBuffer: GPUBuffer
  uvBuffer: GPUBuffer
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

  const uvBuffer = device.createBuffer({
    label: 'sphere uvs',
    size: mesh.uvs.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  })
  device.queue.writeBuffer(uvBuffer, 0, mesh.uvs as BufferSource)

  const indexBuffer = device.createBuffer({
    label: 'sphere indices',
    size: mesh.indices.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  })
  device.queue.writeBuffer(indexBuffer, 0, mesh.indices as BufferSource)

  return { positionBuffer, normalBuffer, uvBuffer, indexBuffer, indexCount: mesh.indices.length }
}

const LINE_POSITION_BUFFER_LAYOUT: GPUVertexBufferLayout = {
  arrayStride: 3 * 4,
  attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }],
}

export async function createLinePipeline(device: GPUDevice, format: GPUTextureFormat): Promise<GPURenderPipeline> {
  const module = device.createShaderModule({ label: 'orbit line shader', code: lineShaderCode })
  return await device.createRenderPipelineAsync({
    label: 'orbit line pipeline',
    layout: 'auto',
    vertex: { module, entryPoint: 'vs', buffers: [LINE_POSITION_BUFFER_LAYOUT] },
    fragment: { module, entryPoint: 'fs', targets: [{ format }] },
    primitive: { topology: 'line-strip' },
    multisample: { count: SAMPLE_COUNT },
    // depthWriteEnabled: false — orbit lines shouldn't occlude each other or leave depth marks
    // that could z-fight against the sphere meshes; depthCompare 'less' still hides line segments
    // that pass behind a planet or the Sun.
    depthStencil: { depthWriteEnabled: false, depthCompare: 'less', format: 'depth24plus' },
  })
}

export function createOrbitPathBuffer(device: GPUDevice, initialPoints: Float32Array): GPUBuffer {
  const buffer = device.createBuffer({
    label: 'orbit path positions',
    size: initialPoints.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  })
  device.queue.writeBuffer(buffer, 0, initialPoints as BufferSource)
  return buffer
}

export function updateOrbitPathBuffer(device: GPUDevice, buffer: GPUBuffer, points: Float32Array): void {
  device.queue.writeBuffer(buffer, 0, points as BufferSource)
}

// Per-instance (x, y, z, brightness), one instance per star — see starShaderCode for how each
// instance expands into a 4-vertex billboard quad with no per-star vertex geometry of its own.
const STAR_INSTANCE_BUFFER_LAYOUT: GPUVertexBufferLayout = {
  arrayStride: 4 * 4,
  stepMode: 'instance',
  attributes: [
    { shaderLocation: 0, offset: 0, format: 'float32x3' },
    { shaderLocation: 1, offset: 3 * 4, format: 'float32' },
  ],
}

export async function createStarPipeline(device: GPUDevice, format: GPUTextureFormat): Promise<GPURenderPipeline> {
  const module = device.createShaderModule({ label: 'star shader', code: starShaderCode })
  return await device.createRenderPipelineAsync({
    label: 'star pipeline',
    layout: 'auto',
    vertex: { module, entryPoint: 'vs', buffers: [STAR_INSTANCE_BUFFER_LAYOUT] },
    fragment: {
      module,
      entryPoint: 'fs',
      targets: [
        {
          format,
          blend: {
            color: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
          },
        },
      ],
    },
    // Camera-facing billboard quads aren't consistently wound the way the sphere mesh is, so
    // there's no meaningful "back face" to cull here. depthCompare 'always' + depthWriteEnabled
    // false means depth testing has no actual effect (stars rely on draw order instead — see
    // main.ts, which draws them first, a painter's-algorithm approach), but WebGPU still requires
    // a pipeline's attachment state (including depth-stencil format) to exactly match the render
    // pass it's used in, so this can't be omitted.
    primitive: { topology: 'triangle-strip', cullMode: 'none' },
    depthStencil: { depthWriteEnabled: false, depthCompare: 'always', format: 'depth24plus' },
    multisample: { count: SAMPLE_COUNT },
  })
}

export function createStarBuffer(device: GPUDevice, catalog: Float32Array): GPUBuffer {
  const buffer = device.createBuffer({
    label: 'star catalog',
    size: Math.max(catalog.byteLength, 4 * 4), // avoid a zero-size buffer if the catalog failed to load
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  })
  if (catalog.byteLength > 0) device.queue.writeBuffer(buffer, 0, catalog as BufferSource)
  return buffer
}

export async function createFlarePipeline(device: GPUDevice, format: GPUTextureFormat): Promise<GPURenderPipeline> {
  const module = device.createShaderModule({ label: 'flare shader', code: flareShaderCode })
  return await device.createRenderPipelineAsync({
    label: 'flare pipeline',
    layout: 'auto',
    vertex: { module, entryPoint: 'vs' },
    fragment: {
      module,
      entryPoint: 'fs',
      targets: [
        {
          format,
          blend: {
            color: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
          },
        },
      ],
    },
    // Same camera-facing-quad reasoning as the star pipeline: no meaningful back face to cull.
    // Unlike stars, this DOES depth-test (depthWriteEnabled false, so the flare itself never
    // occludes anything) against the depth buffer the main pass already populated, so planets in
    // front of the Sun naturally occlude the flare per-pixel.
    primitive: { topology: 'triangle-strip', cullMode: 'none' },
    depthStencil: { depthWriteEnabled: false, depthCompare: 'less', format: 'depth24plus' },
    multisample: { count: SAMPLE_COUNT },
  })
}

const RING_POSITION_BUFFER_LAYOUT: GPUVertexBufferLayout = {
  arrayStride: 3 * 4,
  attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }],
}

const RING_UV_BUFFER_LAYOUT: GPUVertexBufferLayout = {
  arrayStride: 2 * 4,
  attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x2' }],
}

export async function createRingPipeline(device: GPUDevice, format: GPUTextureFormat): Promise<GPURenderPipeline> {
  const module = device.createShaderModule({ label: 'ring shader', code: ringShaderCode })
  return await device.createRenderPipelineAsync({
    label: 'ring pipeline',
    layout: 'auto',
    vertex: { module, entryPoint: 'vs', buffers: [RING_POSITION_BUFFER_LAYOUT, RING_UV_BUFFER_LAYOUT] },
    fragment: {
      module,
      entryPoint: 'fs',
      targets: [
        {
          format,
          // Standard (non-premultiplied) alpha blending: the ring texture's alpha channel encodes
          // real transparency (e.g. the Cassini Division gap), unlike the additive blending used
          // for stars/flares/bloom.
          blend: {
            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
          },
        },
      ],
    },
    // Visible from both above and below; depth-tested but not written, same reasoning as the
    // flare pipeline — the ring shouldn't occlude anything behind it beyond what its alpha implies.
    primitive: { topology: 'triangle-list', cullMode: 'none' },
    depthStencil: { depthWriteEnabled: false, depthCompare: 'less', format: 'depth24plus' },
    multisample: { count: SAMPLE_COUNT },
  })
}

export interface RingBuffers {
  positionBuffer: GPUBuffer
  uvBuffer: GPUBuffer
  indexBuffer: GPUBuffer
  indexCount: number
}

export function createRingBuffers(device: GPUDevice, mesh: RingMesh): RingBuffers {
  const positionBuffer = device.createBuffer({
    label: 'ring positions',
    size: mesh.positions.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  })
  device.queue.writeBuffer(positionBuffer, 0, mesh.positions as BufferSource)

  const uvBuffer = device.createBuffer({
    label: 'ring uvs',
    size: mesh.uvs.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  })
  device.queue.writeBuffer(uvBuffer, 0, mesh.uvs as BufferSource)

  const indexBuffer = device.createBuffer({
    label: 'ring indices',
    size: mesh.indices.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  })
  device.queue.writeBuffer(indexBuffer, 0, mesh.indices as BufferSource)

  return { positionBuffer, uvBuffer, indexBuffer, indexCount: mesh.indices.length }
}

export async function createCloudShellPipeline(device: GPUDevice, format: GPUTextureFormat): Promise<GPURenderPipeline> {
  const module = device.createShaderModule({ label: 'cloud shell shader', code: cloudShellShaderCode })
  return await device.createRenderPipelineAsync({
    label: 'cloud shell pipeline',
    layout: 'auto',
    vertex: { module, entryPoint: 'vs', buffers: [POSITION_BUFFER_LAYOUT, NORMAL_BUFFER_LAYOUT, UV_BUFFER_LAYOUT] },
    fragment: {
      module,
      entryPoint: 'fs',
      targets: [
        {
          format,
          // Same non-premultiplied alpha blending as the ring pipeline.
          blend: {
            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
          },
        },
      ],
    },
    // Unlike the ring (a flat annulus visible from both sides), this is a solid convex sphere, so
    // normal backface culling applies - same frontFace: 'cw' fix as createLitPipeline, since this
    // reuses that exact mesh and winding.
    primitive: { topology: 'triangle-list', cullMode: 'back', frontFace: 'cw' },
    depthStencil: { depthWriteEnabled: false, depthCompare: 'less', format: 'depth24plus' },
    multisample: { count: SAMPLE_COUNT },
  })
}
