import { mat4 } from 'gl-matrix'
import type { Viewpoint } from '../../camera/viewpoint'
import { createUniformBinding, writeUniforms, type UniformBinding } from '../../gpu/buffers'
import { createScenePipeline } from '../../gpu/scenePipeline'
import type { Vec3 } from '../../math/tuples'
import { GROUND_SKY_UNIFORM_FLOAT_COUNT, groundSkyShaderCode } from './groundSkyShader'

// Air lights up in front of everything already drawn; the ground covers it (premultiplied alpha).
const OVER_BLEND: GPUBlendState = {
  color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
  alpha: { srcFactor: 'zero', dstFactor: 'one', operation: 'add' },
}
// Scales what's already drawn down by the source alpha.
const DIM_BLEND: GPUBlendState = {
  color: { srcFactor: 'zero', dstFactor: 'one-minus-src-alpha', operation: 'add' },
  alpha: { srcFactor: 'zero', dstFactor: 'one', operation: 'add' },
}
// Multiplies what's already drawn by the source color.
const FILTER_BLEND: GPUBlendState = {
  color: { srcFactor: 'zero', dstFactor: 'src', operation: 'add' },
  alpha: { srcFactor: 'zero', dstFactor: 'one', operation: 'add' },
}

// Through eclipse glasses, the Sun's light (sunBrightness times its color) comes out this bright:
// just under the bloom pass's threshold, so the crescent stays crisp, as it looks through real glasses.
const GLASSES_SUN_LEVEL = 0.95

// How the sky is lit this frame.
export interface SkyLight {
  // The blue sky's brightness, 1 in full daylight.
  daylight: number
  // The sunset-like glow along the horizon.
  glow: number
  // 1: the glow rings the whole horizon (a total eclipse); 0: it shows only on the Sun's side,
  // with the pink band opposite (dusk and dawn).
  glowSpread: number
  // How much of the stars and the Milky Way the daylight hides.
  hidesStars: number
}

export interface GroundSkyFrame {
  light: SkyLight
  // Straight up from the observer, and any level direction (the hills along the horizon are laid
  // out from it).
  zenith: Vec3
  north: Vec3
  // Eclipse glasses, 0-1.
  glasses: number
  // The Sun's own brightness this frame (see bodies/sunSurface.ts), which the glasses dim.
  sunBrightness: number
  // A solar eclipse's diamond ring: the glint's direction and strength.
  glint?: [number, number, number, number]
}

type Pass = 'dim' | 'sky' | 'glasses'

// The lessons' sky, horizon and eclipse glasses (see groundSkyShader.ts), drawn while a lesson shows
// the view from the ground. The Sun stands at the origin, as in every scene.
export class GroundSky {
  private constructor(
    private readonly device: GPUDevice,
    private readonly passes: Record<Pass, { pipeline: GPURenderPipeline; uniforms: UniformBinding }>,
  ) {}

  static async create(device: GPUDevice, format: GPUTextureFormat): Promise<GroundSky> {
    const pass = async (fragment: string, blend: GPUBlendState) => {
      const pipeline = await createScenePipeline(device, {
        label: `ground sky ${fragment}`,
        code: groundSkyShaderCode,
        format,
        blend,
        primitive: { topology: 'triangle-list' },
        depth: { write: false, compare: 'always' },
        entryPoints: { vertex: 'vs', fragment },
      })
      return { pipeline, uniforms: createUniformBinding(device, pipeline, { label: `ground sky ${fragment}`, floatCount: GROUND_SKY_UNIFORM_FLOAT_COUNT }) }
    }
    const [dim, sky, glasses] = await Promise.all([pass('fsDimBackdrop', DIM_BLEND), pass('fsSky', OVER_BLEND), pass('fsGlasses', FILTER_BLEND)])
    return new GroundSky(device, { dim, sky, glasses })
  }

  update(viewpoint: Viewpoint, sunRadius: number, frame: GroundSkyFrame): void {
    const uniforms = packUniforms(viewpoint, sunRadius, frame)
    for (const { uniforms: binding } of Object.values(this.passes)) writeUniforms(this.device, binding, uniforms)
  }

  // Right after the stars and the Milky Way.
  drawBehindBodies(pass: GPURenderPassEncoder): void {
    this.drawPass(pass, 'dim')
  }

  // After the bodies and the corona.
  drawInFrontOfBodies(pass: GPURenderPassEncoder): void {
    this.drawPass(pass, 'sky')
    this.drawPass(pass, 'glasses')
  }

  private drawPass(pass: GPURenderPassEncoder, which: Pass): void {
    pass.setPipeline(this.passes[which].pipeline)
    pass.setBindGroup(0, this.passes[which].uniforms.bindGroup)
    pass.draw(3)
  }
}

function packUniforms(viewpoint: Viewpoint, sunRadius: number, frame: GroundSkyFrame): Float32Array<ArrayBuffer> {
  const eye = viewpoint.position
  const sunDistance = Math.hypot(eye[0], eye[1], eye[2])
  const { light } = frame
  const values = new Float32Array(GROUND_SKY_UNIFORM_FLOAT_COUNT)
  values.set(rayFromClipSpace(viewpoint), 0)
  values.set([...frame.zenith, light.daylight], 16)
  values.set([-eye[0] / sunDistance, -eye[1] / sunDistance, -eye[2] / sunDistance, Math.asin(Math.min(1, sunRadius / sunDistance))], 20)
  values.set([...frame.north, light.glow], 24)
  values.set([frame.glasses, GLASSES_SUN_LEVEL / frame.sunBrightness, light.hidesStars, light.glowSpread], 28)
  values.set(frame.glint ?? [0, 0, 0, 0], 32)
  return values
}

// Clip space back to a view ray: the inverse of the view-projection without the eye's position.
function rayFromClipSpace(viewpoint: Viewpoint): mat4 {
  const rotationOnlyView = mat4.clone(viewpoint.view)
  rotationOnlyView[12] = 0
  rotationOnlyView[13] = 0
  rotationOnlyView[14] = 0
  const viewProjection = mat4.multiply(mat4.create(), viewpoint.projection, rotationOnlyView)
  return mat4.invert(mat4.create(), viewProjection) ?? mat4.create()
}
