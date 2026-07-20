import {
  bloomCompositeShaderCode,
  bloomDownsampleShaderCode,
  bloomUpsampleShaderCode,
  brightPassShaderCode,
} from './shaders'
import { SAMPLE_COUNT } from './webgpu'
import { createFullscreenPipeline, runFullscreenPass } from './fullscreenPass'

const HDR_FORMAT: GPUTextureFormat = 'rgba16float'
const MAX_BLOOM_MIP_LEVELS = 5

const ADDITIVE_BLEND: GPUBlendState = {
  color: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
  alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
}

export interface BloomPipelines {
  sampler: GPUSampler
  brightPassPipeline: GPURenderPipeline
  downsamplePipeline: GPURenderPipeline
  upsamplePipeline: GPURenderPipeline
  compositePipeline: GPURenderPipeline
}

// Pipelines don't depend on canvas size, so they're created once and reused across resizes (see
// createBloomTargets/destroyBloomTargets for the size-dependent resources).
export async function createBloomPipelines(device: GPUDevice, swapchainFormat: GPUTextureFormat): Promise<BloomPipelines> {
  const sampler = device.createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
    addressModeU: 'clamp-to-edge',
    addressModeV: 'clamp-to-edge',
  })
  const brightPassPipeline = await createFullscreenPipeline(device, brightPassShaderCode, HDR_FORMAT, 'bright-pass pipeline')
  const downsamplePipeline = await createFullscreenPipeline(
    device,
    bloomDownsampleShaderCode,
    HDR_FORMAT,
    'bloom downsample pipeline',
  )
  const upsamplePipeline = await createFullscreenPipeline(
    device,
    bloomUpsampleShaderCode,
    HDR_FORMAT,
    'bloom upsample pipeline',
    ADDITIVE_BLEND,
  )
  const compositePipeline = await createFullscreenPipeline(
    device,
    bloomCompositeShaderCode,
    swapchainFormat,
    'bloom composite pipeline',
  )
  return { sampler, brightPassPipeline, downsamplePipeline, upsamplePipeline, compositePipeline }
}

export interface BloomTargets {
  hdrMultisampleTexture: GPUTexture
  hdrResolveTexture: GPUTexture
  bloomTexture: GPUTexture
  mipCount: number
  brightPassBindGroup: GPUBindGroup
  downsampleBindGroups: GPUBindGroup[]
  upsampleBindGroups: GPUBindGroup[]
  compositeBindGroup: GPUBindGroup
}

function computeMipCount(width: number, height: number): number {
  const smallestDimension = Math.max(1, Math.min(width, height))
  const maxPossibleLevels = Math.floor(Math.log2(smallestDimension)) + 1
  return Math.max(1, Math.min(MAX_BLOOM_MIP_LEVELS, maxPossibleLevels))
}

// Creates the canvas-size-dependent HDR/bloom resources: an MSAA HDR color target the main scene
// pass renders into, a single-sample HDR resolve texture (a real GPUTexture, not the swapchain,
// since it needs to be *sampled* by the bright-pass), and a half-resolution bloom mip chain.
// Callers must destroyBloomTargets() the previous instance and call this again on canvas resize —
// same pattern as createRenderTargets's depth/MSAA textures.
export function createBloomTargets(
  device: GPUDevice,
  pipelines: BloomPipelines,
  canvasWidth: number,
  canvasHeight: number,
): BloomTargets {
  const hdrMultisampleTexture = device.createTexture({
    label: 'hdr msaa color',
    size: [canvasWidth, canvasHeight],
    format: HDR_FORMAT,
    sampleCount: SAMPLE_COUNT,
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  })
  const hdrResolveTexture = device.createTexture({
    label: 'hdr resolve',
    size: [canvasWidth, canvasHeight],
    format: HDR_FORMAT,
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
  })

  const bloomWidth = Math.max(1, Math.floor(canvasWidth / 2))
  const bloomHeight = Math.max(1, Math.floor(canvasHeight / 2))
  const mipCount = computeMipCount(bloomWidth, bloomHeight)
  const bloomTexture = device.createTexture({
    label: 'bloom mip chain',
    size: [bloomWidth, bloomHeight],
    format: HDR_FORMAT,
    mipLevelCount: mipCount,
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
  })
  const mipView = (level: number) => bloomTexture.createView({ baseMipLevel: level, mipLevelCount: 1 })

  const brightPassBindGroup = device.createBindGroup({
    layout: pipelines.brightPassPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: pipelines.sampler },
      { binding: 1, resource: hdrResolveTexture.createView() },
    ],
  })

  // downsampleBindGroups[i] samples mip i and is drawn into mip i+1; upsampleBindGroups[i] samples
  // mip i+1 and is additively blended into mip i (see runBloomAndComposite for the draw order).
  const downsampleBindGroups: GPUBindGroup[] = []
  const upsampleBindGroups: GPUBindGroup[] = []
  for (let i = 0; i < mipCount - 1; i++) {
    downsampleBindGroups.push(
      device.createBindGroup({
        layout: pipelines.downsamplePipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: pipelines.sampler },
          { binding: 1, resource: mipView(i) },
        ],
      }),
    )
    upsampleBindGroups.push(
      device.createBindGroup({
        layout: pipelines.upsamplePipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: pipelines.sampler },
          { binding: 1, resource: mipView(i + 1) },
        ],
      }),
    )
  }

  const compositeBindGroup = device.createBindGroup({
    layout: pipelines.compositePipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: pipelines.sampler },
      { binding: 1, resource: hdrResolveTexture.createView() },
      { binding: 2, resource: mipView(0) },
    ],
  })

  return {
    hdrMultisampleTexture,
    hdrResolveTexture,
    bloomTexture,
    mipCount,
    brightPassBindGroup,
    downsampleBindGroups,
    upsampleBindGroups,
    compositeBindGroup,
  }
}

export function destroyBloomTargets(targets: BloomTargets): void {
  targets.hdrMultisampleTexture.destroy()
  targets.hdrResolveTexture.destroy()
  targets.bloomTexture.destroy()
}

// Runs the bright-pass -> downsample chain -> upsample/blend chain -> composite+tonemap sequence.
// Must run after the main scene pass has already resolved into targets.hdrResolveTexture. This is
// the only part of the frame that writes to swapchainView.
export function runBloomAndComposite(
  encoder: GPUCommandEncoder,
  pipelines: BloomPipelines,
  targets: BloomTargets,
  swapchainView: GPUTextureView,
): void {
  const bloomMipView = (level: number) => targets.bloomTexture.createView({ baseMipLevel: level, mipLevelCount: 1 })

  runFullscreenPass(encoder, pipelines.brightPassPipeline, targets.brightPassBindGroup, bloomMipView(0), 'clear')

  for (let i = 0; i < targets.mipCount - 1; i++) {
    runFullscreenPass(encoder, pipelines.downsamplePipeline, targets.downsampleBindGroups[i], bloomMipView(i + 1), 'clear')
  }

  for (let i = targets.mipCount - 2; i >= 0; i--) {
    runFullscreenPass(encoder, pipelines.upsamplePipeline, targets.upsampleBindGroups[i], bloomMipView(i), 'load')
  }

  runFullscreenPass(encoder, pipelines.compositePipeline, targets.compositeBindGroup, swapchainView, 'clear')
}
