// Camera effects - the lens flare - draw onto the finished, resolved scene image in a pass of their
// own: no depth buffer, since nothing in the picture can be in front of light scattered inside the
// lens, and one sample per pixel, since soft glows gain nothing from multisampling.
export interface CameraEffectPipelineSpec {
  label: string
  code: string
  format: GPUTextureFormat
  primitive: GPUPrimitiveState
  blend: GPUBlendState
}

export async function createCameraEffectPipeline(device: GPUDevice, spec: CameraEffectPipelineSpec): Promise<GPURenderPipeline> {
  const module = device.createShaderModule({ label: `${spec.label} shader`, code: spec.code })
  return device.createRenderPipelineAsync({
    label: `${spec.label} pipeline`,
    layout: 'auto',
    vertex: { module, entryPoint: 'vs' },
    fragment: { module, entryPoint: 'fs', targets: [{ format: spec.format, blend: spec.blend }] },
    primitive: spec.primitive,
  })
}
