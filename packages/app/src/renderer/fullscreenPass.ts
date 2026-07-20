// Shared fullscreen-triangle blit helpers. Originally private to postProcessing.ts's bloom chain;
// extracted so mipmapGenerator.ts can reuse the exact same "one draw call into one render-target
// view" pattern for GPU-side mip generation instead of duplicating it.
export async function createFullscreenPipeline(
  device: GPUDevice,
  code: string,
  targetFormat: GPUTextureFormat,
  label: string,
  blend?: GPUBlendState,
): Promise<GPURenderPipeline> {
  const module = device.createShaderModule({ label, code })
  return await device.createRenderPipelineAsync({
    label,
    layout: 'auto',
    vertex: { module, entryPoint: 'vs' },
    fragment: { module, entryPoint: 'fs', targets: [{ format: targetFormat, blend }] },
    primitive: { topology: 'triangle-list' },
  })
}

export function runFullscreenPass(
  encoder: GPUCommandEncoder,
  pipeline: GPURenderPipeline,
  bindGroup: GPUBindGroup,
  targetView: GPUTextureView,
  loadOp: GPULoadOp,
): void {
  const pass = encoder.beginRenderPass({
    colorAttachments: [{ view: targetView, loadOp, clearValue: { r: 0, g: 0, b: 0, a: 1 }, storeOp: 'store' }],
  })
  pass.setPipeline(pipeline)
  pass.setBindGroup(0, bindGroup)
  pass.draw(3)
  pass.end()
}
