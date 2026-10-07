import { mat4 } from 'gl-matrix'
import type { Viewpoint } from '../camera/viewpoint'
import { createUniformBinding, writeUniforms, type UniformBinding } from '../gpu/buffers'
import { ADDITIVE_BLEND, createScenePipeline } from '../gpu/scenePipeline'
import type { TextureLoader } from '../gpu/textureLoader'
import { sceneToGalactic } from './galacticFrame'
import { SKY_UNIFORM_FLOAT_COUNT, skyShaderCode } from './skyShader'

const SKY_BRIGHTNESS = 1

// The Milky Way, its nebulae and the nearest galaxies, painted onto the inside of an infinitely
// distant sphere and aligned with the real star catalog (see skyShader.ts).
export class SkyBackdrop {
  private readonly galacticFrame = sceneToGalactic()

  private constructor(
    private readonly device: GPUDevice,
    private readonly pipeline: GPURenderPipeline,
    private readonly uniforms: UniformBinding,
  ) {}

  static async create(device: GPUDevice, format: GPUTextureFormat, textures: TextureLoader): Promise<SkyBackdrop> {
    const pipeline = await createScenePipeline(device, {
      label: 'sky',
      code: skyShaderCode,
      format,
      blend: ADDITIVE_BLEND,
      primitive: { topology: 'triangle-list' },
      // Like the stars: drawn first, painted over by everything else.
      depth: { write: false, compare: 'always' },
    })
    const panorama = await textures.loadColor('sky/milkyWay.jpg')
    const sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear', addressModeU: 'repeat', addressModeV: 'clamp-to-edge' })
    const uniforms = createUniformBinding(device, pipeline, { label: 'sky', floatCount: SKY_UNIFORM_FLOAT_COUNT, resources: [panorama.createView(), sampler] })
    return new SkyBackdrop(device, pipeline, uniforms)
  }

  update(viewpoint: Viewpoint): void {
    const rotationOnlyView = mat4.clone(viewpoint.view)
    rotationOnlyView[12] = 0
    rotationOnlyView[13] = 0
    rotationOnlyView[14] = 0
    const viewProjection = mat4.multiply(mat4.create(), viewpoint.projection, rotationOnlyView)
    const uniforms = new Float32Array(SKY_UNIFORM_FLOAT_COUNT)
    uniforms.set(mat4.invert(mat4.create(), viewProjection) ?? mat4.create(), 0)
    const frame = this.galacticFrame
    uniforms.set([frame[0], frame[1], frame[2], 0, frame[3], frame[4], frame[5], 0, frame[6], frame[7], frame[8], 0], 16)
    uniforms.set([SKY_BRIGHTNESS, 0, 0, 0], 28)
    writeUniforms(this.device, this.uniforms, uniforms)
  }

  // Must be the first draw of the pass, before the stars.
  draw(pass: GPURenderPassEncoder): void {
    pass.setPipeline(this.pipeline)
    pass.setBindGroup(0, this.uniforms.bindGroup)
    pass.draw(3)
  }
}
