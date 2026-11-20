import type { mat4 } from 'gl-matrix'
import type { Viewpoint } from '../camera/viewpoint'
import { createScenePipeline } from '../gpu/scenePipeline'
import type { TextureLoader } from '../gpu/textureLoader'
import type { Vec3 } from '../math/tuples'
import { MODEL_VERTEX_FLOATS, type ModelData } from './modelFile'
import { ASSEMBLY_KIND_CODE, MAX_ASSEMBLIES, MODEL_UNIFORM_FLOAT_COUNT, modelShaderCode } from './modelShader'

const MODEL_VERTEX_BUFFERS: GPUVertexBufferLayout[] = [
  {
    arrayStride: MODEL_VERTEX_FLOATS * 4,
    attributes: [
      { shaderLocation: 0, offset: 0, format: 'float32x3' },
      { shaderLocation: 1, offset: 12, format: 'float32x3' },
      { shaderLocation: 2, offset: 24, format: 'float32x2' },
      { shaderLocation: 3, offset: 32, format: 'float32' },
    ],
  },
]

// How a model is shown this frame.
export interface ModelPose {
  // Model (metres, its own frame) to world.
  world: mat4
  // Toward the Sun, in world space.
  toSun: Vec3
  // 0: assembled, 1: taken fully apart (each assembly moved by its offset).
  explode: number
  // The assembly picked out (-1: none), and how strongly (0 hides the effect).
  highlight: { assembly: number; strength: number }
  // How strong the sunlight and the shadowless fill are; a texture that is a photo of something
  // already lit (the Golden Record) wants mostly fill, so it isn't darkened twice.
  light?: { sun: number; fill: number }
  // How far it is cut open (0: closed, 1: open from the bottom to the top of the exploded view).
  cut?: number
  // How visible each assembly is (0 to 1, by index; 1 where not given): parts thrown off fade.
  visibility?: readonly number[]
}

// A spacecraft in sunlight: the shadowed side stays dark, as in space, with a faint fill.
const SUNLIT = { sun: 1, fill: 0.07 }
const SHININESS = 24
const OFFSETS_AT = 48
const PARTS_AT = OFFSETS_AT + MAX_ASSEMBLIES * 4

// What every model shares: the device, the scene's color format, the pipeline, the texture loader
// and a sampler.
export interface ModelContext {
  device: GPUDevice
  format: GPUTextureFormat
  pipeline: GPURenderPipeline
  textures: TextureLoader
  sampler: GPUSampler
}

export async function createModelContext(device: GPUDevice, format: GPUTextureFormat, textures: TextureLoader): Promise<ModelContext> {
  const pipeline = await createScenePipeline(device, {
    label: 'textured model',
    code: modelShaderCode,
    format,
    primitive: { topology: 'triangle-list', cullMode: 'none' },
    depth: { write: true, compare: 'less' },
    buffers: MODEL_VERTEX_BUFFERS,
  })
  const sampler = device.createSampler({ label: 'model sampler', magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear', maxAnisotropy: 16 })
  return { device, format, pipeline, textures, sampler }
}

interface Draw {
  bindGroup: GPUBindGroup
  firstIndex: number
  indexCount: number
}

// Draws one textured model (a spacecraft, the Golden Record): one draw per texture, all reading one
// uniform block.
export class ModelRenderer {
  private readonly values = new Float32Array(MODEL_UNIFORM_FLOAT_COUNT)

  private constructor(
    private readonly context: ModelContext,
    private readonly mesh: { vertex: GPUBuffer; index: GPUBuffer; format: GPUIndexFormat; uniforms: GPUBuffer },
    private readonly draws: Draw[],
    private readonly cutaway: Cutaway,
  ) {}

  // The model's textures are loaded from next to it (`textureBaseUrl`/<file>).
  static async create(context: ModelContext, model: ModelData, textureBaseUrl: string): Promise<ModelRenderer> {
    const { device } = context
    const uniforms = device.createBuffer({ label: 'model uniforms', size: MODEL_UNIFORM_FLOAT_COUNT * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST })
    const draws = await Promise.all(
      model.description.draws.map(async ({ texture, firstIndex, indexCount }) => ({
        bindGroup: bindTexture(context, uniforms, await context.textures.loadColor(`${textureBaseUrl}/${texture}`)),
        firstIndex,
        indexCount,
      })),
    )
    return new ModelRenderer(context, { ...uploadMesh(device, model), uniforms }, draws, cutawayOf(model))
  }

  // `offsets`: how far each assembly moves out when fully exploded (metres, model frame).
  update(viewpoint: Viewpoint, pose: ModelPose, offsets: readonly Vec3[]): void {
    const { values } = this
    values.set(viewpoint.viewProjection, 0)
    values.set(pose.world, 16)
    const light = pose.light ?? SUNLIT
    values.set([...pose.toSun, light.sun], 32)
    values.set([viewpoint.position[0], viewpoint.position[1], viewpoint.position[2], 1], 36)
    values.set([light.fill, SHININESS, pose.explode, 0], 40)
    const cut = pose.cut ?? 0
    values.set([pose.highlight.assembly, pose.highlight.strength, cut > 0 ? 1 : 0, this.cutaway.bottom + cut * this.cutaway.reach], 44)
    offsets.slice(0, MAX_ASSEMBLIES).forEach((offset, index) => values.set([...offset, 0], OFFSETS_AT + index * 4))
    for (let index = 0; index < MAX_ASSEMBLIES; index++) values.set([this.cutaway.kinds[index], pose.visibility?.[index] ?? 1, 0, 0], PARTS_AT + index * 4)
    this.context.device.queue.writeBuffer(this.mesh.uniforms, 0, values)
  }

  draw(pass: GPURenderPassEncoder): void {
    pass.setPipeline(this.context.pipeline)
    pass.setVertexBuffer(0, this.mesh.vertex)
    pass.setIndexBuffer(this.mesh.index, this.mesh.format)
    for (const { bindGroup, firstIndex, indexCount } of this.draws) {
      pass.setBindGroup(0, bindGroup)
      pass.drawIndexed(indexCount, 1, firstIndex)
    }
  }
}

// What the cut needs: each assembly's kind as the shader counts it, and the heights the cut sweeps
// over - from the model's bottom to its top with every part moved fully out.
interface Cutaway {
  kinds: number[]
  bottom: number
  reach: number
}

function cutawayOf({ description }: ModelData): Cutaway {
  const kinds = Array.from({ length: MAX_ASSEMBLIES }, (_, index) => ASSEMBLY_KIND_CODE[description.assemblies[index]?.kind ?? 'solid'])
  const highest = Math.max(0, ...description.assemblies.map((assembly) => assembly.explode[1]))
  const { min, max } = description.bounds
  return { kinds, bottom: min[1], reach: max[1] + highest - min[1] }
}

function bindTexture({ device, pipeline, sampler }: ModelContext, uniforms: GPUBuffer, texture: GPUTexture): GPUBindGroup {
  return device.createBindGroup({
    label: `model ${texture.label}`,
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniforms } },
      { binding: 1, resource: sampler },
      { binding: 2, resource: texture.createView() },
    ],
  })
}

// Buffer sizes must be multiples of 4 bytes: an odd count of 16-bit indices is padded.
function uploadMesh(device: GPUDevice, { vertices, indices, description }: ModelData): { vertex: GPUBuffer; index: GPUBuffer; format: GPUIndexFormat } {
  const vertex = device.createBuffer({ label: 'model vertices', size: vertices.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST })
  device.queue.writeBuffer(vertex, 0, vertices)
  const indexBytes = Math.ceil(indices.byteLength / 4) * 4
  const index = device.createBuffer({ label: 'model indices', size: indexBytes, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST })
  const padded = new Uint8Array(indexBytes)
  padded.set(new Uint8Array(indices.buffer, indices.byteOffset, indices.byteLength))
  device.queue.writeBuffer(index, 0, padded)
  return { vertex, index, format: description.indexFormat }
}
