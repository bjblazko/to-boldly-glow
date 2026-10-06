import { DEPTH_FORMAT, SAMPLE_COUNT } from './renderTargets'

export const ADDITIVE_BLEND: GPUBlendState = {
  color: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
  alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
}

// Standard (non-premultiplied) alpha blending, for textures/shading whose alpha is real transparency.
export const ALPHA_BLEND: GPUBlendState = {
  color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
  alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
}

// The sphere mesh (see bodies/sphereMesh.ts) is wound clockwise as seen from outside, the opposite
// of WebGPU's default front face: with 'ccw', back-face culling removed the camera-facing hemisphere.
export const SOLID_SPHERE_PRIMITIVE: GPUPrimitiveState = { topology: 'triangle-list', cullMode: 'back', frontFace: 'cw' }

// Camera-facing billboard quads have no meaningful back face.
export const BILLBOARD_PRIMITIVE: GPUPrimitiveState = { topology: 'triangle-strip', cullMode: 'none' }

export interface ScenePipelineSpec {
  label: string
  code: string
  format: GPUTextureFormat
  primitive: GPUPrimitiveState
  depth: { write: boolean; compare: GPUCompareFunction }
  buffers?: GPUVertexBufferLayout[]
  blend?: GPUBlendState
}

// Every pipeline drawing into the main scene pass shares its multisampling and depth format (WebGPU
// requires a pipeline's attachment state to match the pass exactly) and the vs/fs entry points.
export async function createScenePipeline(device: GPUDevice, spec: ScenePipelineSpec): Promise<GPURenderPipeline> {
  const module = device.createShaderModule({ label: `${spec.label} shader`, code: spec.code })
  return device.createRenderPipelineAsync({
    label: `${spec.label} pipeline`,
    layout: 'auto',
    vertex: { module, entryPoint: 'vs', buffers: spec.buffers ?? [] },
    fragment: { module, entryPoint: 'fs', targets: [{ format: spec.format, blend: spec.blend }] },
    primitive: spec.primitive,
    depthStencil: { depthWriteEnabled: spec.depth.write, depthCompare: spec.depth.compare, format: DEPTH_FORMAT },
    multisample: { count: SAMPLE_COUNT },
  })
}
