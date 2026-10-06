// A single draw of a fullscreen triangle into one render-target view - shared by the bloom chain
// and texture mip generation. Shaders include FULLSCREEN_TRIANGLE_VERTEX_WGSL for their vertex stage.
export interface FullscreenPipelineSpec {
  label: string
  code: string
  format: GPUTextureFormat
  blend?: GPUBlendState
}

export async function createFullscreenPipeline(device: GPUDevice, spec: FullscreenPipelineSpec): Promise<GPURenderPipeline> {
  const module = device.createShaderModule({ label: spec.label, code: spec.code })
  return device.createRenderPipelineAsync({
    label: spec.label,
    layout: 'auto',
    vertex: { module, entryPoint: 'vs' },
    fragment: { module, entryPoint: 'fs', targets: [{ format: spec.format, blend: spec.blend }] },
    primitive: { topology: 'triangle-list' },
  })
}

export interface FullscreenPass {
  pipeline: GPURenderPipeline
  bindGroup: GPUBindGroup
  target: GPUTextureView
  // 'load' keeps the target's contents (to blend onto them), 'clear' starts from black.
  loadOp: GPULoadOp
}

export function runFullscreenPass(encoder: GPUCommandEncoder, { pipeline, bindGroup, target, loadOp }: FullscreenPass): void {
  const pass = encoder.beginRenderPass({
    colorAttachments: [{ view: target, loadOp, clearValue: { r: 0, g: 0, b: 0, a: 1 }, storeOp: 'store' }],
  })
  pass.setPipeline(pipeline)
  pass.setBindGroup(0, bindGroup)
  pass.draw(3)
  pass.end()
}
