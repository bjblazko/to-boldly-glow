export const SAMPLE_COUNT = 4
export const DEPTH_FORMAT: GPUTextureFormat = 'depth24plus'

export interface RenderTargets {
  depthTexture: GPUTexture
  multisampleColorTexture: GPUTexture
}

// The depth and MSAA color textures are tied to the canvas's backing-store size; unlike the canvas's
// own swapchain texture they don't follow it automatically, so they are recreated on every resize.
export function createRenderTargets(device: GPUDevice, format: GPUTextureFormat, width: number, height: number): RenderTargets {
  // The depth is read back too (the film look's ambient occlusion, see bloom/filmLook.ts).
  const attachment = (textureFormat: GPUTextureFormat, usage: number): GPUTexture =>
    device.createTexture({
      size: [width, height],
      format: textureFormat,
      sampleCount: SAMPLE_COUNT,
      usage,
    })
  return {
    depthTexture: attachment(DEPTH_FORMAT, GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING),
    multisampleColorTexture: attachment(format, GPUTextureUsage.RENDER_ATTACHMENT),
  }
}

export function destroyRenderTargets(targets: RenderTargets): void {
  targets.depthTexture.destroy()
  targets.multisampleColorTexture.destroy()
}
