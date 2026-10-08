import { mat4, vec3 } from 'gl-matrix'
import type { Viewpoint } from '../../camera/viewpoint'
import { createUniformBinding, writeUniforms, type UniformBinding } from '../../gpu/buffers'
import { createScenePipeline } from '../../gpu/scenePipeline'
import { sunVisibleFraction } from '../../lensFlare/sunVisibility'
import { clamp } from '../../math/tuples'
import type { SceneLayout } from '../../scene/sceneLayout'
import type { EclipseStage } from '../lessonTypes'
import { GROUND_SKY_UNIFORM_FLOAT_COUNT, groundSkyShaderCode } from './groundSkyShader'
import { perpendicularUnit } from './eclipseGeometry'
import { TOWARD_SUN_ON_HORIZON, ZENITH } from './skyGeometry'

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

// How bright the sky looks as the Moon covers the Sun. The eye adapts, so the light seems to fade
// far more slowly than the Sun's disc shrinks - until the last few percent are gone, when it falls
// away within seconds.
const DAYLIGHT_EXPONENT = 0.4
const LAST_LIGHT_FRACTION = 0.02
// Through the glasses, the Sun's light (sunBrightness times its color) comes out this bright: just
// under the bloom pass's threshold, so the crescent stays crisp, as it looks through real glasses.
const GLASSES_SUN_LEVEL = 0.95

type Pass = 'dim' | 'sky' | 'glasses'

// The eclipse lesson's sky, horizon and eclipse glasses (see groundSkyShader.ts).
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

  // Returns the sky's light this frame.
  update(layout: SceneLayout, viewpoint: Viewpoint, frame: { stage: EclipseStage; sunBrightness: number }): SkyLight {
    const visible = sunVisibleFraction(layout, viewpoint)
    const light = skyLight(visible)
    const uniforms = packUniforms(viewpoint, light, { ...frame, sunRadius: layout.sun.radius })
    uniforms.set(diamond(layout, viewpoint, visible), 32)
    for (const { uniforms: binding } of Object.values(this.passes)) writeUniforms(this.device, binding, uniforms)
    return light
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

export interface SkyLight {
  // The blue sky's brightness, 1 in full daylight.
  daylight: number
  // The sunset-like glow along the horizon, 1 in totality.
  glow: number
  // How much of the stars and the Milky Way the daylight hides.
  hidesStars: number
}

// The diamond ring's glint shows while only the last sliver of the Sun is left.
export function diamondStrength(sunVisibleFraction: number): number {
  return smoothstep(0, 0.004, sunVisibleFraction) * (1 - smoothstep(0.02, 0.06, sunVisibleFraction))
}

// Where the last sliver is - on the Sun's edge right across from the Moon's center - and how
// brightly it glints.
function diamond(layout: SceneLayout, viewpoint: Viewpoint, visible: number): number[] {
  const moon = layout.moons[0]
  const strength = diamondStrength(visible)
  if (!moon || strength <= 0) return [0, 0, 0, 0]
  const eye = viewpoint.position
  const toSun = vec3.normalize(vec3.create(), vec3.negate(vec3.create(), eye))
  const toMoon = vec3.normalize(vec3.create(), vec3.subtract(vec3.create(), moon.position, eye))
  const awayFromMoon = perpendicularUnit(vec3.subtract(vec3.create(), toSun, toMoon), toSun)
  const sunAngularRadius = Math.asin(Math.min(1, layout.sun.radius / vec3.length(eye)))
  const glint = [0, 1, 2].map((i) => toSun[i] * Math.cos(sunAngularRadius) + awayFromMoon[i] * Math.sin(sunAngularRadius))
  return [...glint, strength]
}

export function skyLight(sunVisibleFraction: number): SkyLight {
  const visible = clamp(sunVisibleFraction, 0, 1)
  const daylight = Math.pow(visible, DAYLIGHT_EXPONENT) * smoothstep(0, LAST_LIGHT_FRACTION, visible)
  return { daylight, glow: 1 - smoothstep(0, 0.3, daylight), hidesStars: smoothstep(0, 0.3, daylight) }
}

function packUniforms(viewpoint: Viewpoint, light: SkyLight, frame: { stage: EclipseStage; sunBrightness: number; sunRadius: number }): Float32Array<ArrayBuffer> {
  const rotationOnlyView = mat4.clone(viewpoint.view)
  rotationOnlyView[12] = 0
  rotationOnlyView[13] = 0
  rotationOnlyView[14] = 0
  const viewProjection = mat4.multiply(mat4.create(), viewpoint.projection, rotationOnlyView)
  const eye = viewpoint.position
  const sunDistance = Math.hypot(eye[0], eye[1], eye[2])
  const values = new Float32Array(GROUND_SKY_UNIFORM_FLOAT_COUNT)
  values.set(mat4.invert(mat4.create(), viewProjection) ?? mat4.create(), 0)
  values.set([...ZENITH, light.daylight], 16)
  values.set([-eye[0] / sunDistance, -eye[1] / sunDistance, -eye[2] / sunDistance, Math.asin(Math.min(1, frame.sunRadius / sunDistance))], 20)
  values.set([...TOWARD_SUN_ON_HORIZON, light.glow], 24)
  values.set([frame.stage.glasses, GLASSES_SUN_LEVEL / frame.sunBrightness, light.hidesStars, 0], 28)
  return values
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}
