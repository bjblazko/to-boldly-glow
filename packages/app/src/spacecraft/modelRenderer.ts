import { vec3, type mat4 } from 'gl-matrix'
import type { Viewpoint } from '../camera/viewpoint'
import { createScenePipeline } from '../gpu/scenePipeline'
import type { TextureLoader } from '../gpu/textureLoader'
import type { Vec3 } from '../math/tuples'
import { MODEL_VERTEX_FLOATS, type ModelData } from './modelFile'
import { packHinges } from './modelHinge'
import { ASSEMBLY_KIND_CODE, MAX_ASSEMBLIES, MAX_LAMPS, MODEL_UNIFORM_FLOAT_COUNT, modelShaderCode } from './modelShader'
import { createShadowPipeline, lampViewProjection, ModelShadowMap, SHADOW_FORMAT, SHADOW_MAP_SIZE } from './modelShadow'

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
  // `wear`: grime, streaks and uneven paint drawn over surfaces in the model's own frame (0: none,
  // 1: a vehicle that has stood on the pad), for models whose textures are plain colours.
  light?: { sun: number; fill: number; wear?: number }
  // How far it is cut open (0: closed, 1: open from the bottom to the top of the exploded view).
  cut?: number
  // How visible each assembly is (0 to 1, by index; 1 where not given): parts thrown off fade.
  visibility?: readonly number[]
  // Lamps lighting it from near by (a cabin's floodlights), in world space.
  lamps?: readonly Lamp[]
  // Each assembly's material, by index (a soft plastic sheen where not given).
  materials?: readonly (Material | undefined)[]
  // Each assembly's fold about its hinge, by index (see modelHinge.ts; none: nothing folds).
  hinges?: readonly Float32Array[]
}

// How a surface shines: how tight its highlight is and how strong; a mirror-like one (the command
// module's aluminized skin) also reflects its surroundings, as strongly as it shines.
export interface Material {
  shininess: number
  shine: number
  mirror?: boolean
}

// What the shader gets for a material (part.zw): a mirror-like one by a negative shininess.
export function materialCode({ shininess, shine, mirror }: Material): [number, number] {
  return [mirror ? -shininess : shininess, shine]
}

const PLAIN: Material = { shininess: 24, shine: 0.25 }

// A lamp: where it is, how far its light reaches (metres) and its colour times its strength.
export interface Lamp {
  place: Vec3
  reach: number
  color: Vec3
}

// A spacecraft in sunlight: the shadowed side stays dark, as in space, with a faint fill.
const SUNLIT: { sun: number; fill: number; wear?: number } = { sun: 1, fill: 0.07 }
const OFFSETS_AT = 48
const PARTS_AT = OFFSETS_AT + MAX_ASSEMBLIES * 4
const LAMPS_AT = PARTS_AT + MAX_ASSEMBLIES * 4
const SHADOW_AT = LAMPS_AT + MAX_LAMPS * 8
const HINGES_AT = SHADOW_AT + 20

// What every model shares: the device, the scene's color format, the pipelines (both faces of
// every triangle drawn - a probe's thin sheets - or only the front - a scanned room, whose surfaces
// are not meant to be seen from behind), the texture loader and a sampler, and for lamps' shadows
// their depth-only pipeline, a comparing sampler and a map that shadows nothing (for models without).
export interface ModelContext {
  device: GPUDevice
  format: GPUTextureFormat
  pipelines: Record<'bothSides' | 'frontOnly', GPURenderPipeline>
  textures: TextureLoader
  sampler: GPUSampler
  shadows: { pipeline: GPURenderPipeline; sampler: GPUSampler; none: GPUTextureView }
}

export async function createModelContext(device: GPUDevice, format: GPUTextureFormat, textures: TextureLoader): Promise<ModelContext> {
  const pipeline = (cullMode: GPUCullMode) =>
    createScenePipeline(device, {
      label: `textured model (${cullMode === 'none' ? 'both sides' : 'front only'})`,
      code: modelShaderCode,
      format,
      primitive: { topology: 'triangle-list', cullMode },
      depth: { write: true, compare: 'less' },
      buffers: MODEL_VERTEX_BUFFERS,
    })
  const [bothSides, frontOnly, shadowPipeline] = await Promise.all([pipeline('none'), pipeline('back'), createShadowPipeline(device)])
  // Repeating: some models tile a texture across a part (NASSP's lunar module's spars and radiator).
  const sampler = device.createSampler({ label: 'model sampler', addressModeU: 'repeat', addressModeV: 'repeat', magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear', maxAnisotropy: 16 })
  const shadowSampler = device.createSampler({ label: 'model shadow sampler', compare: 'less-equal', magFilter: 'linear', minFilter: 'linear' })
  const none = device.createTexture({ label: 'no shadow map', size: [1, 1], format: SHADOW_FORMAT, usage: GPUTextureUsage.TEXTURE_BINDING }).createView()
  return { device, format, pipelines: { bothSides, frontOnly }, textures, sampler, shadows: { pipeline: shadowPipeline, sampler: shadowSampler, none } }
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
    private readonly mesh: { pipeline: GPURenderPipeline; vertex: GPUBuffer; index: GPUBuffer; format: GPUIndexFormat; indexCount: number; uniforms: GPUBuffer },
    private readonly draws: Draw[],
    private readonly shape: { cutaway: Cutaway; middle: Vec3; shadowMap: ModelShadowMap | null },
  ) {}

  // The model's textures are loaded from next to it (`textureBaseUrl`/<file>); `shadows`: lamps
  // will light it and the first casts shadows (a shadow map of its own).
  static async create(context: ModelContext, model: ModelData, textureBaseUrl: string, { shadows = false } = {}): Promise<ModelRenderer> {
    const { device } = context
    const pipeline = model.description.oneSided ? context.pipelines.frontOnly : context.pipelines.bothSides
    const shadowMap = shadows ? ModelShadowMap.create(device, context.shadows.pipeline) : null
    const uniforms = device.createBuffer({ label: 'model uniforms', size: MODEL_UNIFORM_FLOAT_COUNT * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST })
    const draws = await Promise.all(
      model.description.draws.map(async ({ texture, firstIndex, indexCount }) => ({
        bindGroup: bindTexture(context, { pipeline, uniforms, shadowMap: shadowMap?.view ?? context.shadows.none }, await context.textures.loadColor(`${textureBaseUrl}/${texture}`)),
        firstIndex,
        indexCount,
      })),
    )
    const { min, max } = model.description.bounds
    const middle: Vec3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2]
    return new ModelRenderer(context, { pipeline, ...uploadMesh(device, model), indexCount: model.description.indexCount, uniforms }, draws, { cutaway: cutawayOf(model), middle, shadowMap })
  }

  // `offsets`: how far each assembly moves out when fully exploded (metres, model frame).
  update(viewpoint: Viewpoint, pose: ModelPose, offsets: readonly Vec3[]): void {
    const { values } = this
    values.set(viewpoint.viewProjection, 0)
    values.set(pose.world, 16)
    const light = pose.light ?? SUNLIT
    values.set([...pose.toSun, light.sun], 32)
    values.set([viewpoint.position[0], viewpoint.position[1], viewpoint.position[2], 1], 36)
    values.set([light.fill, light.wear ?? 0, pose.explode, 0], 40)
    const cut = pose.cut ?? 0
    const { cutaway } = this.shape
    values.set([pose.highlight.assembly, pose.highlight.strength, cut > 0 ? 1 : 0, cutaway.bottom + cut * cutaway.reach], 44)
    writeAssemblies(values, pose, cutaway.kinds, offsets)
    writeLamps(values, pose.lamps ?? [])
    this.updateShadow(pose, offsets)
    this.context.device.queue.writeBuffer(this.mesh.uniforms, 0, values)
  }

  // Before the scene's pass: the first lamp's shadow map, for a model that has one and a lamp.
  encodeShadow(encoder: GPUCommandEncoder): void {
    if (this.shape.shadowMap && this.values[SHADOW_AT + 16] > 0) this.shape.shadowMap.encode(encoder, this.mesh)
  }

  // The first lamp looks at the model's middle; its projection goes to both shaders.
  private updateShadow(pose: ModelPose, offsets: readonly Vec3[]): void {
    const lamp = pose.lamps?.[0]
    const { shadowMap, middle } = this.shape
    if (!shadowMap || !lamp) {
      this.values.set([0, 0, 0, 0], SHADOW_AT + 16)
      return
    }
    const target = vec3.transformMat4(vec3.create(), middle, pose.world) as unknown as Vec3
    const lightViewProjection = lampViewProjection(lamp.place, [target[0], target[1], target[2]], lamp.reach)
    shadowMap.update(lightViewProjection, pose.world, { amount: pose.explode, offsets, hinges: pose.hinges })
    this.values.set(lightViewProjection, SHADOW_AT)
    this.values.set([1, 1 / SHADOW_MAP_SIZE, 0, 0], SHADOW_AT + 16)
  }

  draw(pass: GPURenderPassEncoder): void {
    pass.setPipeline(this.mesh.pipeline)
    pass.setVertexBuffer(0, this.mesh.vertex)
    pass.setIndexBuffer(this.mesh.index, this.mesh.format)
    for (const { bindGroup, firstIndex, indexCount } of this.draws) {
      pass.setBindGroup(0, bindGroup)
      pass.drawIndexed(indexCount, 1, firstIndex)
    }
  }
}

// Each assembly's offset, its kind, how visible it is, its material and its fold.
function writeAssemblies(values: Float32Array, pose: ModelPose, kinds: readonly number[], offsets: readonly Vec3[]): void {
  offsets.slice(0, MAX_ASSEMBLIES).forEach((offset, index) => values.set([...offset, 0], OFFSETS_AT + index * 4))
  writeParts(values, pose, kinds)
  packHinges(values, HINGES_AT, pose.hinges, MAX_ASSEMBLIES)
}

function writeParts(values: Float32Array, { visibility, materials }: ModelPose, kinds: readonly number[]): void {
  for (let index = 0; index < MAX_ASSEMBLIES; index++) {
    values.set([kinds[index], visibility?.[index] ?? 1, ...materialCode(materials?.[index] ?? PLAIN)], PARTS_AT + index * 4)
  }
}

// Each lamp's place and reach, then its colour; the slots left over stay dark (reach 0).
function writeLamps(values: Float32Array, lamps: readonly Lamp[]): void {
  for (let index = 0; index < MAX_LAMPS; index++) {
    const lamp = lamps[index]
    values.set(lamp ? [...lamp.place, lamp.reach] : [0, 0, 0, 0], LAMPS_AT + index * 4)
    values.set(lamp ? [...lamp.color, 0] : [0, 0, 0, 0], LAMPS_AT + (MAX_LAMPS + index) * 4)
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

function bindTexture({ device, sampler, shadows }: ModelContext, { pipeline, uniforms, shadowMap }: { pipeline: GPURenderPipeline; uniforms: GPUBuffer; shadowMap: GPUTextureView }, texture: GPUTexture): GPUBindGroup {
  return device.createBindGroup({
    label: `model ${texture.label}`,
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniforms } },
      { binding: 1, resource: sampler },
      { binding: 2, resource: texture.createView() },
      { binding: 3, resource: shadows.sampler },
      { binding: 4, resource: shadowMap },
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
