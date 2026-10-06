import { createUniformBinding, writeUniforms, type UniformBinding } from '../gpu/buffers'
import { ADDITIVE_BLEND, BILLBOARD_PRIMITIVE, createScenePipeline } from '../gpu/scenePipeline'
import type { Viewpoint } from '../camera/viewpoint'
import type { SceneLayout } from '../scene/sceneLayout'
import { FLARE_SPECS, type FlareSpec } from './flareSpecs'
import { flareShaderCode } from './flareShader'
import { sunVisibleFraction } from './sunVisibility'

const FLARE_UNIFORM_FLOAT_COUNT = 12

interface FlareSprite {
  spec: FlareSpec
  uniforms: UniformBinding
}

interface SunOnScreen {
  ndc: [number, number, number]
  visibleFraction: number
}

// Screen-space flare sprites along the line from the Sun through the screen center, faded by how
// much of the Sun a nearer body covers and depth-tested so bodies in front clip them per pixel.
export class LensFlare {
  private sunInFront = false

  private constructor(
    private readonly device: GPUDevice,
    private readonly pipeline: GPURenderPipeline,
    private readonly sprites: FlareSprite[],
  ) {}

  static async create(device: GPUDevice, format: GPUTextureFormat): Promise<LensFlare> {
    const pipeline = await createScenePipeline(device, {
      label: 'flare',
      code: flareShaderCode,
      format,
      blend: ADDITIVE_BLEND,
      primitive: BILLBOARD_PRIMITIVE,
      // Depth-tested against the bodies already drawn, never writing depth itself.
      depth: { write: false, compare: 'less' },
    })
    const sprites = FLARE_SPECS.map((spec, index) => ({
      spec,
      uniforms: createUniformBinding(device, pipeline, { label: `flare ${index}`, floatCount: FLARE_UNIFORM_FLOAT_COUNT }),
    }))
    return new LensFlare(device, pipeline, sprites)
  }

  update(layout: SceneLayout, viewpoint: Viewpoint): void {
    const sun = sunOnScreen(layout, viewpoint)
    this.sunInFront = sun !== null
    if (sun) for (const sprite of this.sprites) this.writeSprite(sprite, sun, viewpoint)
  }

  // Drawn last, after every body has written its depth.
  draw(pass: GPURenderPassEncoder): void {
    if (!this.sunInFront) return
    pass.setPipeline(this.pipeline)
    for (const sprite of this.sprites) {
      pass.setBindGroup(0, sprite.uniforms.bindGroup)
      pass.draw(4)
    }
  }

  private writeSprite({ spec, uniforms }: FlareSprite, sun: SunOnScreen, viewpoint: Viewpoint): void {
    // t = 0 sits on the Sun, 0.5 on the screen center, beyond that on the mirrored side.
    const mirror = 1 - 2 * spec.t
    const [red, green, blue, alpha] = spec.color
    const fade = sun.visibleFraction
    const values = new Float32Array(FLARE_UNIFORM_FLOAT_COUNT)
    // Additive blending ignores alpha, so the fade has to scale the color itself.
    values.set([red * fade, green * fade, blue * fade, alpha], 0)
    values.set([sun.ndc[0] * mirror, sun.ndc[1] * mirror], 4)
    values.set([(spec.widthPx * 2) / viewpoint.pixels.width, (spec.heightPx * 2) / viewpoint.pixels.height], 6)
    values.set([sun.ndc[2], spec.bladeCount, spec.rotation], 8)
    writeUniforms(this.device, uniforms, values)
  }
}

// The Sun sits at the world origin, so its clip-space position is just the view-projection's
// translation column; null when the Sun is behind the camera.
function sunOnScreen(layout: SceneLayout, viewpoint: Viewpoint): SunOnScreen | null {
  const clip = viewpoint.viewProjection
  const clipW = clip[15]
  if (clipW <= 0) return null
  return { ndc: [clip[12] / clipW, clip[13] / clipW, clip[14] / clipW], visibleFraction: sunVisibleFraction(layout, viewpoint) }
}
