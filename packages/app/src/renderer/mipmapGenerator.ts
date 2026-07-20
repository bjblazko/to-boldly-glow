import { bloomDownsampleShaderCode } from './shaders'
import { createFullscreenPipeline, runFullscreenPass } from './fullscreenPass'

// Reuses the bloom pass's own downsample shader verbatim (a 5-tap dual-Kawase-style filter,
// structurally exactly what mip generation needs) against a second pipeline instance targeting the
// body-texture format instead of the bloom chain's HDR format — see docs/roadmap.md's "Planet
// texture mipmaps" entry for why this reuse was the intended approach rather than new shader code.
export async function createMipmapPipeline(device: GPUDevice, format: GPUTextureFormat): Promise<GPURenderPipeline> {
  return createFullscreenPipeline(device, bloomDownsampleShaderCode, format, 'mipmap generate pipeline')
}

// Deliberately no mipmapFilter here: this sampler is only ever used with textureSampleLevel against
// a view that exposes exactly one explicit mip level (see generateMipmaps below), not for a
// mip-selecting sample during normal scene rendering (that's createBodySampler's job).
export function createMipmapSampler(device: GPUDevice): GPUSampler {
  return device.createSampler({ label: 'mipmap generate sampler', magFilter: 'linear', minFilter: 'linear' })
}

// Generates the full mip chain for `texture` (which must have been created with RENDER_ATTACHMENT
// usage) by successively blitting each level into the next, one manual fullscreen-pass draw per
// level, all recorded into a single command buffer submitted once at the end. Because the source
// format is `rgba8unorm-srgb`, textureSampleLevel decodes to linear on read and the render
// attachment write re-encodes to sRGB on store — averaging happens in linear light "for free,"
// which is the physically correct way to generate mips, with no manual gamma math needed here.
export function generateMipmaps(
  device: GPUDevice,
  texture: GPUTexture,
  mipLevelCount: number,
  pipeline: GPURenderPipeline,
  sampler: GPUSampler,
): void {
  if (mipLevelCount <= 1) return
  const encoder = device.createCommandEncoder({ label: 'mipmap generate' })
  for (let level = 0; level < mipLevelCount - 1; level++) {
    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: sampler },
        { binding: 1, resource: texture.createView({ baseMipLevel: level, mipLevelCount: 1 }) },
      ],
    })
    const targetView = texture.createView({ baseMipLevel: level + 1, mipLevelCount: 1 })
    runFullscreenPass(encoder, pipeline, bindGroup, targetView, 'clear')
  }
  device.queue.submit([encoder.finish()])
}
