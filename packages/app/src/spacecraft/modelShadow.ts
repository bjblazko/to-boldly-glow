import { mat4 } from 'gl-matrix'
import type { Vec3 } from '../math/tuples'
import { MODEL_VERTEX_FLOATS } from './modelFile'
import { HINGE_WGSL, packHinges } from './modelHinge'
import { MAX_ASSEMBLIES } from './modelShader'

// A lamp's shadow map: the model drawn from the lamp, depth only, so the model's own shader can tell
// which surfaces the lamp can't see. One map per model that is lit by lamps (a cabin), seen as a
// spotlight with a wide cone from the lamp toward the model's middle.

export const SHADOW_MAP_SIZE = 2048
export const SHADOW_FORMAT: GPUTextureFormat = 'depth32float'
// The lamp's cone, and how near and far it sees (metres).
const CONE_RADIANS = (120 * Math.PI) / 180
const NEAR = 0.05

// lightViewProjection, world, look (z: how far taken apart), then each assembly's offset and its
// fold about its hinge (three rows).
const SHADOW_UNIFORM_FLOAT_COUNT = 16 + 16 + 4 + MAX_ASSEMBLIES * 4 + MAX_ASSEMBLIES * 12
const HINGES_AT = 36 + MAX_ASSEMBLIES * 4

export const shadowShaderCode = /* wgsl */ `
struct Uniforms {
  lightViewProjection: mat4x4f,
  world: mat4x4f,
  look: vec4f,
  offsets: array<vec4f, ${MAX_ASSEMBLIES}>,
  hinges: array<vec4f, ${MAX_ASSEMBLIES * 3}>,
}
${HINGE_WGSL}

@group(0) @binding(0) var<uniform> uni: Uniforms;

@vertex
fn vs(@location(0) position: vec3f, @location(3) assembly: f32) -> @builtin(position) vec4f {
  let index = i32(round(assembly));
  let moved = hinged(index, position, 1.0) + uni.offsets[index].xyz * uni.look.z;
  return uni.lightViewProjection * uni.world * vec4f(moved, 1.0);
}
`

// The depth-only pipeline every shadow map draws with (same vertex layout as the model's own).
export function createShadowPipeline(device: GPUDevice): Promise<GPURenderPipeline> {
  const module = device.createShaderModule({ label: 'model shadow shader', code: shadowShaderCode })
  return device.createRenderPipelineAsync({
    label: 'model shadow pipeline',
    layout: 'auto',
    vertex: {
      module,
      entryPoint: 'vs',
      buffers: [{ arrayStride: MODEL_VERTEX_FLOATS * 4, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 3, offset: 32, format: 'float32' }] }],
    },
    // Both faces: a wall seen from behind still casts its shadow.
    primitive: { topology: 'triangle-list', cullMode: 'none' },
    depthStencil: { format: SHADOW_FORMAT, depthWriteEnabled: true, depthCompare: 'less', depthBias: 2, depthBiasSlopeScale: 2 },
  })
}

// Where the lamp looks and how it projects: from its place toward `target`, as a spotlight.
export function lampViewProjection(place: Vec3, target: Vec3, reach: number): mat4 {
  const up: Vec3 = Math.abs(target[1] - place[1]) > 0.9 * Math.hypot(target[0] - place[0], target[1] - place[1], target[2] - place[2]) ? [0, 0, 1] : [0, 1, 0]
  const view = mat4.lookAt(mat4.create(), place, target, up)
  const projection = mat4.perspectiveZO(mat4.create(), CONE_RADIANS, 1, NEAR, reach)
  return mat4.multiply(mat4.create(), projection, view)
}

export interface ShadowMesh {
  vertex: GPUBuffer
  index: GPUBuffer
  format: GPUIndexFormat
  indexCount: number
}

export class ModelShadowMap {
  readonly view: GPUTextureView
  private readonly values = new Float32Array(SHADOW_UNIFORM_FLOAT_COUNT)

  private constructor(
    private readonly device: GPUDevice,
    private readonly gpu: { pipeline: GPURenderPipeline; uniforms: GPUBuffer; bindGroup: GPUBindGroup; texture: GPUTexture },
  ) {
    this.view = gpu.texture.createView()
  }

  static create(device: GPUDevice, pipeline: GPURenderPipeline): ModelShadowMap {
    const texture = device.createTexture({ label: 'model shadow map', size: [SHADOW_MAP_SIZE, SHADOW_MAP_SIZE], format: SHADOW_FORMAT, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING })
    const uniforms = device.createBuffer({ label: 'model shadow uniforms', size: SHADOW_UNIFORM_FLOAT_COUNT * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST })
    const bindGroup = device.createBindGroup({ label: 'model shadow', layout: pipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: uniforms } }] })
    return new ModelShadowMap(device, { pipeline, uniforms, bindGroup, texture })
  }

  update(lightViewProjection: mat4, world: mat4, explode: { amount: number; offsets: readonly Vec3[]; hinges?: readonly Float32Array[] }): void {
    const { values } = this
    values.set(lightViewProjection, 0)
    values.set(world, 16)
    values.set([0, 0, explode.amount, 0], 32)
    explode.offsets.slice(0, MAX_ASSEMBLIES).forEach((offset, index) => values.set([...offset, 0], 36 + index * 4))
    packHinges(values, HINGES_AT, explode.hinges, MAX_ASSEMBLIES)
    this.device.queue.writeBuffer(this.gpu.uniforms, 0, values)
  }

  // Draws the model's depth from the lamp, before the scene's pass.
  encode(encoder: GPUCommandEncoder, mesh: ShadowMesh): void {
    const pass = encoder.beginRenderPass({
      label: 'model shadow pass',
      colorAttachments: [],
      depthStencilAttachment: { view: this.view, depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store' },
    })
    pass.setPipeline(this.gpu.pipeline)
    pass.setBindGroup(0, this.gpu.bindGroup)
    pass.setVertexBuffer(0, mesh.vertex)
    pass.setIndexBuffer(mesh.index, mesh.format)
    pass.drawIndexed(mesh.indexCount)
    pass.end()
  }
}
