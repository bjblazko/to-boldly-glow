import { downsampleShaderCode } from './downsampleShader'
import { createFullscreenPipeline, runFullscreenPass } from './fullscreenPass'

// Fills a texture's mip chain on the GPU by blitting each level into the next with the bloom
// chain's downsample filter (a 5-tap dual-Kawase-style filter, exactly what mip generation needs).
// For an sRGB texture, sampling decodes to linear and writing re-encodes, so the averaging happens
// in linear light - the physically correct way - with no gamma math here.
export class MipmapGenerator {
  private constructor(
    private readonly device: GPUDevice,
    private readonly pipeline: GPURenderPipeline,
    private readonly sampler: GPUSampler,
  ) {}

  static async create(device: GPUDevice, format: GPUTextureFormat): Promise<MipmapGenerator> {
    const pipeline = await createFullscreenPipeline(device, { label: 'mipmap generate pipeline', code: downsampleShaderCode, format })
    // No mipmapFilter: every sample reads a view exposing exactly one mip level.
    const sampler = device.createSampler({ label: 'mipmap generate sampler', magFilter: 'linear', minFilter: 'linear' })
    return new MipmapGenerator(device, pipeline, sampler)
  }

  // The texture needs RENDER_ATTACHMENT usage; level 0 must already hold the image.
  generate(texture: GPUTexture): void {
    if (texture.mipLevelCount <= 1) return
    const encoder = this.device.createCommandEncoder({ label: 'mipmap generate' })
    const levelView = (level: number) => texture.createView({ baseMipLevel: level, mipLevelCount: 1 })
    for (let level = 0; level < texture.mipLevelCount - 1; level++) {
      const bindGroup = this.device.createBindGroup({
        layout: this.pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: this.sampler },
          { binding: 1, resource: levelView(level) },
        ],
      })
      runFullscreenPass(encoder, { pipeline: this.pipeline, bindGroup, target: levelView(level + 1), loadOp: 'clear' })
    }
    this.device.queue.submit([encoder.finish()])
  }
}
