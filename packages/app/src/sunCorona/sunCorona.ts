import { mat4, vec3 } from 'gl-matrix'
import { closeUpBrightness, sunScreenCoverage } from '../bodies/sunSurface'
import type { Viewpoint } from '../camera/viewpoint'
import { createUniformBinding, writeUniforms, type UniformBinding } from '../gpu/buffers'
import { ADDITIVE_BLEND, BILLBOARD_PRIMITIVE, createScenePipeline } from '../gpu/scenePipeline'
import { sunVisibleFraction } from '../lensFlare/sunVisibility'
import type { Vec3 } from '../math/tuples'
import { bodyWorldMatrix, type SceneLayout, type SunPose } from '../scene/sceneLayout'
import { CORONA_STRUCTURE, CORONA_UNIFORM_FLOAT_COUNT, coronaShaderCode } from './coronaShader'
import { CORONA_EXTENT_RADII, coronaExposure, coronaQuad, seenAcross } from './coronaView'

const POLE_FLOATS_AT = 52
const STREAMERS_AT = 56
const PROMINENCES_AT = STREAMERS_AT + 4 * CORONA_STRUCTURE.streamers.length

// The Sun's corona, with its chromosphere and prominences (see coronaShader.ts): one quad, blended
// on top of whatever lies behind the Sun and covered by whatever lies in front of it.
export class SunCorona {
  private constructor(
    private readonly device: GPUDevice,
    private readonly pipeline: GPURenderPipeline,
    private readonly uniforms: UniformBinding,
  ) {}

  static async create(device: GPUDevice, format: GPUTextureFormat): Promise<SunCorona> {
    const pipeline = await createScenePipeline(device, {
      label: 'sun corona',
      code: coronaShaderCode,
      format,
      primitive: BILLBOARD_PRIMITIVE,
      blend: ADDITIVE_BLEND,
      depth: { write: false, compare: 'less' },
    })
    const uniforms = createUniformBinding(device, pipeline, { label: 'sun corona', floatCount: CORONA_UNIFORM_FLOAT_COUNT })
    return new SunCorona(device, pipeline, uniforms)
  }

  // sunBrightness is the Sun's own (see bodies/sunSurface.ts): when the camera stops down for a Sun
  // filling the picture, the corona dims with it.
  update(layout: SceneLayout, viewpoint: Viewpoint, sunBrightness: number): void {
    const stopDown = closeUpBrightness(sunBrightness, sunScreenCoverage(layout.sun, viewpoint)) / sunBrightness
    const exposure = coronaExposure(sunVisibleFraction(layout, viewpoint), stopDown)
    writeUniforms(this.device, this.uniforms, packCoronaUniforms(layout.sun, viewpoint, exposure))
  }

  draw(pass: GPURenderPassEncoder): void {
    pass.setPipeline(this.pipeline)
    pass.setBindGroup(0, this.uniforms.bindGroup)
    pass.draw(4)
  }
}

function packCoronaUniforms(sun: SunPose, viewpoint: Viewpoint, exposure: { corona: number; hydrogen: number }): Float32Array<ArrayBuffer> {
  const quad = coronaQuad(sun, viewpoint.position)
  // Rotation only: the Sun's world matrix at unit scale, without its translation.
  const sunToWorld = mat4.multiply(mat4.create(), mat4.fromTranslation(mat4.create(), vec3.negate(vec3.create(), sun.position)), bodyWorldMatrix(sun, 1))
  const values = new Float32Array(CORONA_UNIFORM_FLOAT_COUNT)
  values.set(viewpoint.viewProjection, 0)
  values.set(sunToWorld, 16)
  values.set([...sun.position, sun.radius], 32)
  values.set([...quad.axisU, quad.distanceRadii], 36)
  values.set([...quad.axisV, 0], 40)
  values.set([...quad.lineOfSight, 0], 44)
  values.set([exposure.corona, exposure.hydrogen, CORONA_EXTENT_RADII, 0], 48)
  packSeenStructure(values, (direction) => seenAcross(inWorld(sunToWorld, direction), quad.lineOfSight))
  return values
}

// Where the Sun's pole, streamers and prominences show up in the sky this frame.
function packSeenStructure(values: Float32Array, seen: (direction: Vec3) => [number, number, number, number]): void {
  const pole = seen([0, 0, 1])
  values.set([pole[0] * pole[3], pole[1] * pole[3], pole[2] * pole[3], 0], POLE_FLOATS_AT)
  CORONA_STRUCTURE.streamers.forEach((streamer, index) => values.set(seen(streamer.direction), STREAMERS_AT + 4 * index))
  CORONA_STRUCTURE.prominences.forEach((prominence, index) => values.set(seen(prominence.direction), PROMINENCES_AT + 4 * index))
}

function inWorld(sunToWorld: mat4, direction: Vec3): Vec3 {
  const world = vec3.transformMat4(vec3.create(), direction, sunToWorld)
  return [world[0], world[1], world[2]]
}
