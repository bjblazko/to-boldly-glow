import { createUniformBinding, type UniformBinding } from '../gpu/buffers'
import { ADDITIVE_BLEND, BILLBOARD_PRIMITIVE, createScenePipeline } from '../gpu/scenePipeline'
import type { Viewpoint } from '../camera/viewpoint'
import type { SceneLayout } from '../scene/sceneLayout'
import { FLARE_ELEMENTS } from './flareElements'
import { FLOATS_PER_ELEMENT, MAX_FLARE_ELEMENTS, frameFade, packFlareElements } from './flareLayout'
import { flareShaderCode } from './flareShader'
import { sunVisibleFraction } from './sunVisibility'

const HEADER_FLOATS = 4
const FLARE_UNIFORM_FLOAT_COUNT = HEADER_FLOATS + MAX_FLARE_ELEMENTS * FLOATS_PER_ELEMENT
// Below this the flare is invisible anyway; skip drawing it.
const MIN_STRENGTH = 0.001

// The flare pipeline draws over the finished scene: additive, and never depth-tested. A flare is
// light scattered inside the camera, so nothing in the picture can sit in front of it.
export function flarePipelineSpec(format: GPUTextureFormat) {
  return {
    label: 'flare',
    code: flareShaderCode,
    format,
    blend: ADDITIVE_BLEND,
    primitive: BILLBOARD_PRIMITIVE,
    depth: { write: false, compare: 'always' as const },
  }
}

// A cinematic lens flare for the Sun: a glow, the aperture's starburst, an anamorphic streak, a
// rainbow halo, aperture-shaped ghosts along the line through the screen center, and lit-up lens
// dirt. How strongly it shows depends only on how much of the Sun reaches the lens: bodies in front
// of the Sun dim it, and it fades as the Sun leaves the frame.
export class LensFlare {
  private strength = 0

  private constructor(
    private readonly device: GPUDevice,
    private readonly pipeline: GPURenderPipeline,
    private readonly uniforms: UniformBinding,
  ) {}

  static async create(device: GPUDevice, format: GPUTextureFormat): Promise<LensFlare> {
    const pipeline = await createScenePipeline(device, flarePipelineSpec(format))
    const uniforms = createUniformBinding(device, pipeline, { label: 'lens flare', floatCount: FLARE_UNIFORM_FLOAT_COUNT })
    device.queue.writeBuffer(uniforms.buffer, HEADER_FLOATS * 4, packFlareElements(FLARE_ELEMENTS))
    return new LensFlare(device, pipeline, uniforms)
  }

  update(layout: SceneLayout, viewpoint: Viewpoint): void {
    const sunNdc = sunScreenPosition(viewpoint)
    this.strength = sunNdc ? sunVisibleFraction(layout, viewpoint) * frameFade(sunNdc) : 0
    if (!sunNdc || this.strength < MIN_STRENGTH) return
    const header = new Float32Array([sunNdc[0], sunNdc[1], viewpoint.pixels.width / viewpoint.pixels.height, this.strength])
    this.device.queue.writeBuffer(this.uniforms.buffer, 0, header)
  }

  // Drawn last: over every body, ring, line and overlay.
  draw(pass: GPURenderPassEncoder): void {
    if (this.strength < MIN_STRENGTH) return
    pass.setPipeline(this.pipeline)
    pass.setBindGroup(0, this.uniforms.bindGroup)
    pass.draw(4, FLARE_ELEMENTS.length)
  }
}

// The Sun sits at the world origin, so its clip-space position is the view-projection's
// translation column; null when the Sun is behind the camera.
function sunScreenPosition(viewpoint: Viewpoint): [number, number] | null {
  const clip = viewpoint.viewProjection
  const clipW = clip[15]
  return clipW > 0 ? [clip[12] / clipW, clip[13] / clipW] : null
}
