import type { GpuContext } from '../gpu/device'
import { createRenderTargets, destroyRenderTargets, type RenderTargets } from '../gpu/renderTargets'
import { Bloom, HDR_FORMAT } from '../bloom/bloom'
import type { Tonemapper } from '../bloom/tonemapWgsl'

// Dark navy space. The direct path writes it to the (non-sRGB) swapchain as is; the bloom path's
// composite gamma-encodes afterward, so its HDR clear value is pre-linearized (^2.2) to end up as
// the same displayed color instead of a washed-out gray.
const DIRECT_BACKGROUND: GPUColorDict = { r: 0.02, g: 0.02, b: 0.05, a: 1 }
const HDR_BACKGROUND: GPUColorDict = { r: 0.02 ** 2.2, g: 0.02 ** 2.2, b: 0.05 ** 2.2, a: 1 }

// Where the scene pass draws: into bloom's HDR targets when bloom is available (it then composites
// onto the swapchain), otherwise into a multisampled target resolved straight to the swapchain.
export class SceneTargets {
  private constructor(
    private readonly gpu: GpuContext,
    private readonly canvas: HTMLCanvasElement,
    private readonly bloom: Bloom | null,
    private targets: RenderTargets,
  ) {}

  static async create(gpu: GpuContext, canvas: HTMLCanvasElement): Promise<SceneTargets> {
    const targets = createRenderTargets(gpu.device, gpu.format, canvas.width, canvas.height)
    const bloom = await Bloom.tryCreate(gpu.device, gpu.format, canvas)
    return new SceneTargets(gpu, canvas, bloom, targets)
  }

  get bloomSupported(): boolean {
    return this.bloom !== null
  }

  // The format every scene pipeline renders into.
  get sceneFormat(): GPUTextureFormat {
    return this.bloom ? HDR_FORMAT : this.gpu.format
  }

  // Call after the canvas's backing store changed size.
  resize(): void {
    destroyRenderTargets(this.targets)
    this.targets = createRenderTargets(this.gpu.device, this.gpu.format, this.canvas.width, this.canvas.height)
    this.bloom?.resize(this.canvas)
  }

  beginScenePass(encoder: GPUCommandEncoder): GPURenderPassEncoder {
    const color = this.bloom
      ? this.bloom.sceneAttachment()
      : { view: this.targets.multisampleColorTexture.createView(), resolveTarget: this.swapchainView() }
    return encoder.beginRenderPass({
      colorAttachments: [{ ...color, clearValue: this.bloom ? HDR_BACKGROUND : DIRECT_BACKGROUND, loadOp: 'clear', storeOp: 'discard' }],
      depthStencilAttachment: {
        view: this.targets.depthTexture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
    })
  }

  // Camera effects draw onto the resolved scene image (see gpu/cameraEffectPipeline.ts) - before
  // bloom, so their bright cores bloom too.
  beginCameraEffectsPass(encoder: GPUCommandEncoder): GPURenderPassEncoder {
    const view = this.bloom ? this.bloom.sceneImageView() : this.swapchainView()
    return encoder.beginRenderPass({ label: 'camera effects pass', colorAttachments: [{ view, loadOp: 'load', storeOp: 'store' }] })
  }

  // After the scene and camera-effects passes: bloom's composite is then the only write to the
  // swapchain. Without bloom there is no HDR image, so nothing to tonemap either.
  present(encoder: GPUCommandEncoder, tonemapper: Tonemapper): void {
    this.bloom?.composite(encoder, this.swapchainView(), tonemapper)
  }

  private swapchainView(): GPUTextureView {
    return this.gpu.context.getCurrentTexture().createView()
  }
}
