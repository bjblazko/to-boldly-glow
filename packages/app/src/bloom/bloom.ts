import { SAMPLE_COUNT } from '../gpu/renderTargets'
import { ADDITIVE_BLEND } from '../gpu/scenePipeline'
import { createFullscreenPipeline, runFullscreenPass } from '../gpu/fullscreenPass'
import { downsampleShaderCode } from '../gpu/downsampleShader'
import { bloomCompositeShaderCode, bloomUpsampleShaderCode, brightPassShaderCode } from './bloomShaders'

export const HDR_FORMAT: GPUTextureFormat = 'rgba16float'
const MAX_BLOOM_MIP_LEVELS = 5

interface BloomPipelines {
  sampler: GPUSampler
  brightPass: GPURenderPipeline
  downsample: GPURenderPipeline
  upsample: GPURenderPipeline
  composite: GPURenderPipeline
}

interface BloomTargets {
  hdrMultisampleTexture: GPUTexture
  hdrResolveTexture: GPUTexture
  bloomTexture: GPUTexture
  mipCount: number
  brightPassBindGroup: GPUBindGroup
  // downsample[i] reads mip i and is drawn into mip i+1; upsample[i] reads mip i+1 and is added onto mip i.
  downsampleBindGroups: GPUBindGroup[]
  upsampleBindGroups: GPUBindGroup[]
  compositeBindGroup: GPUBindGroup
}

// HDR glow around the Sun: the scene renders into an HDR target, whose over-bright parts are blurred
// down and up a half-resolution mip chain, added back and tonemapped onto the swapchain.
export class Bloom {
  private constructor(
    private readonly device: GPUDevice,
    private readonly pipelines: BloomPipelines,
    private targets: BloomTargets,
  ) {}

  // Bloom is a nicety: if its setup fails, the app falls back to rendering straight to the swapchain.
  static async tryCreate(device: GPUDevice, swapchainFormat: GPUTextureFormat, size: { width: number; height: number }): Promise<Bloom | null> {
    try {
      const pipelines = await createBloomPipelines(device, swapchainFormat)
      return new Bloom(device, pipelines, createBloomTargets(device, pipelines, size))
    } catch (error) {
      console.warn('Bloom post-processing unavailable, falling back to direct rendering.', error)
      return null
    }
  }

  resize(size: { width: number; height: number }): void {
    destroyBloomTargets(this.targets)
    this.targets = createBloomTargets(this.device, this.pipelines, size)
  }

  // The scene pass draws into the multisampled HDR texture and resolves into a sampleable one.
  sceneAttachment(): { view: GPUTextureView; resolveTarget: GPUTextureView } {
    return { view: this.targets.hdrMultisampleTexture.createView(), resolveTarget: this.targets.hdrResolveTexture.createView() }
  }

  // Bright pass -> downsample chain -> upsample chain -> composite + tonemap onto the swapchain.
  composite(encoder: GPUCommandEncoder, swapchainView: GPUTextureView): void {
    const { pipelines, targets } = this
    const mipView = (level: number) => targets.bloomTexture.createView({ baseMipLevel: level, mipLevelCount: 1 })
    const pass = (pipeline: GPURenderPipeline, bindGroup: GPUBindGroup, target: GPUTextureView, loadOp: GPULoadOp = 'clear') =>
      runFullscreenPass(encoder, { pipeline, bindGroup, target, loadOp })
    pass(pipelines.brightPass, targets.brightPassBindGroup, mipView(0))
    for (let i = 0; i < targets.mipCount - 1; i++) pass(pipelines.downsample, targets.downsampleBindGroups[i], mipView(i + 1))
    for (let i = targets.mipCount - 2; i >= 0; i--) pass(pipelines.upsample, targets.upsampleBindGroups[i], mipView(i), 'load')
    pass(pipelines.composite, targets.compositeBindGroup, swapchainView)
  }
}

async function createBloomPipelines(device: GPUDevice, swapchainFormat: GPUTextureFormat): Promise<BloomPipelines> {
  return {
    sampler: device.createSampler({ magFilter: 'linear', minFilter: 'linear', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge' }),
    brightPass: await createFullscreenPipeline(device, { label: 'bright-pass pipeline', code: brightPassShaderCode, format: HDR_FORMAT }),
    downsample: await createFullscreenPipeline(device, { label: 'bloom downsample pipeline', code: downsampleShaderCode, format: HDR_FORMAT }),
    upsample: await createFullscreenPipeline(device, { label: 'bloom upsample pipeline', code: bloomUpsampleShaderCode, format: HDR_FORMAT, blend: ADDITIVE_BLEND }),
    composite: await createFullscreenPipeline(device, { label: 'bloom composite pipeline', code: bloomCompositeShaderCode, format: swapchainFormat }),
  }
}

function computeMipCount(width: number, height: number): number {
  const smallestDimension = Math.max(1, Math.min(width, height))
  const maxPossibleLevels = Math.floor(Math.log2(smallestDimension)) + 1
  return Math.max(1, Math.min(MAX_BLOOM_MIP_LEVELS, maxPossibleLevels))
}

function createBloomTargets(device: GPUDevice, pipelines: BloomPipelines, size: { width: number; height: number }): BloomTargets {
  const hdrMultisampleTexture = device.createTexture({
    label: 'hdr msaa color',
    size: [size.width, size.height],
    format: HDR_FORMAT,
    sampleCount: SAMPLE_COUNT,
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  })
  const hdrResolveTexture = createSampleableTexture(device, 'hdr resolve', [size.width, size.height], 1)
  const bloomSize = [Math.max(1, Math.floor(size.width / 2)), Math.max(1, Math.floor(size.height / 2))]
  const mipCount = computeMipCount(bloomSize[0], bloomSize[1])
  const bloomTexture = createSampleableTexture(device, 'bloom mip chain', bloomSize, mipCount)
  const mipView = (level: number) => bloomTexture.createView({ baseMipLevel: level, mipLevelCount: 1 })
  const bindGroup = (pipeline: GPURenderPipeline, views: GPUTextureView[]) =>
    device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [pipelines.sampler, ...views].map((resource, binding) => ({ binding, resource })),
    })
  const levels = Array.from({ length: mipCount - 1 }, (_, i) => i)
  return {
    hdrMultisampleTexture,
    hdrResolveTexture,
    bloomTexture,
    mipCount,
    brightPassBindGroup: bindGroup(pipelines.brightPass, [hdrResolveTexture.createView()]),
    downsampleBindGroups: levels.map((i) => bindGroup(pipelines.downsample, [mipView(i)])),
    upsampleBindGroups: levels.map((i) => bindGroup(pipelines.upsample, [mipView(i + 1)])),
    compositeBindGroup: bindGroup(pipelines.composite, [hdrResolveTexture.createView(), mipView(0)]),
  }
}

function createSampleableTexture(device: GPUDevice, label: string, size: number[], mipLevelCount: number): GPUTexture {
  return device.createTexture({
    label,
    size,
    format: HDR_FORMAT,
    mipLevelCount,
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
  })
}

function destroyBloomTargets(targets: BloomTargets): void {
  targets.hdrMultisampleTexture.destroy()
  targets.hdrResolveTexture.destroy()
  targets.bloomTexture.destroy()
}
