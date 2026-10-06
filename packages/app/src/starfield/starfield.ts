import { mat4 } from 'gl-matrix'
import { createUniformBinding, createVertexBuffer, writeUniforms, type UniformBinding } from '../gpu/buffers'
import { ADDITIVE_BLEND, BILLBOARD_PRIMITIVE, createScenePipeline } from '../gpu/scenePipeline'
import type { Viewpoint } from '../camera/viewpoint'
import { loadStarCatalog } from './starCatalog'
import { starShaderCode } from './starShader'

const STAR_UNIFORM_FLOAT_COUNT = 20
const STAR_SIZE_PX = 3
const FLOATS_PER_STAR = 4

// Per-instance (x, y, z, brightness); each instance expands into a 4-vertex billboard in the shader.
const STAR_INSTANCE_BUFFERS: GPUVertexBufferLayout[] = [
  {
    arrayStride: FLOATS_PER_STAR * 4,
    stepMode: 'instance',
    attributes: [
      { shaderLocation: 0, offset: 0, format: 'float32x3' },
      { shaderLocation: 1, offset: 3 * 4, format: 'float32' },
    ],
  },
]

// The real night sky (Yale Bright Star Catalogue), drawn as an infinitely distant backdrop.
export class Starfield {
  private constructor(
    private readonly device: GPUDevice,
    private readonly pipeline: GPURenderPipeline,
    private readonly stars: { buffer: GPUBuffer; count: number },
    private readonly uniforms: UniformBinding,
  ) {}

  get starCount(): number {
    return this.stars.count
  }

  static async create(device: GPUDevice, format: GPUTextureFormat): Promise<Starfield> {
    const pipeline = await createScenePipeline(device, {
      label: 'star',
      code: starShaderCode,
      format,
      buffers: STAR_INSTANCE_BUFFERS,
      blend: ADDITIVE_BLEND,
      primitive: BILLBOARD_PRIMITIVE,
      // Stars rely on being drawn first instead of on depth (see draw); the depth state still has to
      // match the scene pass's attachments.
      depth: { write: false, compare: 'always' },
    })
    const catalog = await loadStarCatalog('stars/starCatalog.bin')
    const uniforms = createUniformBinding(device, pipeline, { label: 'star', floatCount: STAR_UNIFORM_FLOAT_COUNT })
    return new Starfield(device, pipeline, { buffer: createStarBuffer(device, catalog), count: catalog.length / FLOATS_PER_STAR }, uniforms)
  }

  // The view's translation is dropped, so the stars turn with the camera but never move with it.
  update(viewpoint: Viewpoint): void {
    const rotationOnlyView = mat4.clone(viewpoint.view)
    rotationOnlyView[12] = 0
    rotationOnlyView[13] = 0
    rotationOnlyView[14] = 0
    const uniforms = new Float32Array(STAR_UNIFORM_FLOAT_COUNT)
    uniforms.set(mat4.multiply(mat4.create(), viewpoint.projection, rotationOnlyView), 0)
    uniforms.set([(STAR_SIZE_PX * 2) / viewpoint.pixels.width, (STAR_SIZE_PX * 2) / viewpoint.pixels.height], 16)
    writeUniforms(this.device, this.uniforms, uniforms)
  }

  // Must be the first draw of the pass: without depth testing, everything drawn later paints over it.
  draw(pass: GPURenderPassEncoder): void {
    pass.setPipeline(this.pipeline)
    pass.setVertexBuffer(0, this.stars.buffer)
    pass.setBindGroup(0, this.uniforms.bindGroup)
    pass.draw(4, this.starCount)
  }
}

// At least one star's worth of bytes, so a failed catalog load doesn't create a zero-size buffer.
function createStarBuffer(device: GPUDevice, catalog: Float32Array): GPUBuffer {
  return createVertexBuffer(device, 'star catalog', catalog.length > 0 ? catalog : new Float32Array(FLOATS_PER_STAR))
}
