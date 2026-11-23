import type { Viewpoint } from '../../camera/viewpoint'
import { createUniformBinding, writeUniforms, type UniformBinding } from '../../gpu/buffers'
import { ADDITIVE_BLEND, createScenePipeline } from '../../gpu/scenePipeline'
import type { Vec3 } from '../../math/tuples'

// An engine burning in vacuum: a hot glow at the nozzle's exit, brighter than white so the bloom
// makes it shine, and a faint plume widening and fading behind it - soft spots added onto the
// picture along the exhaust's way (depth tested against the craft, not written). In the metre pass.

export const MAX_PLUMES = 2
const SPOTS = 28

// viewProjection, the camera's right and up, then per plume: its exit and length, its way and the
// exit's radius, its colour and strength.
const FLOATS = 16 + 4 + 4 + MAX_PLUMES * 12

const shaderCode = /* wgsl */ `
struct Uniforms {
  viewProjection: mat4x4f,
  right: vec4f,
  up: vec4f,
  exits: array<vec4f, ${MAX_PLUMES}>,
  ways: array<vec4f, ${MAX_PLUMES}>,
  colors: array<vec4f, ${MAX_PLUMES}>,
}

@group(0) @binding(0) var<uniform> uni: Uniforms;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) corner: vec2f,
  @location(1) light: vec3f,
}

@vertex
fn vs(@builtin(vertex_index) vertexIndex: u32, @builtin(instance_index) instance: u32) -> VertexOutput {
  var corners = array<vec2f, 4>(vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0), vec2f(1.0, 1.0));
  let corner = corners[vertexIndex];
  let plume = instance / ${SPOTS}u;
  let spot = f32(instance % ${SPOTS}u) / ${SPOTS - 1}.0;
  let exit = uni.exits[plume];
  let way = uni.ways[plume];
  let color = uni.colors[plume];
  // The first spot is the nozzle's glow; the rest the plume, widening and fading along its length.
  let core = spot == 0.0;
  let size = select(way.w * (1.0 + 3.0 * spot) * 1.2, way.w * 1.6, core) * select(0.0, 1.0, color.w > 0.0);
  let place = exit.xyz + way.xyz * exit.w * spot * spot;
  let brightness = select(0.22 * pow(1.0 - spot, 1.6), 2.6, core) * color.w;
  var out: VertexOutput;
  out.position = uni.viewProjection * vec4f(place + (uni.right.xyz * corner.x + uni.up.xyz * corner.y) * size, 1.0);
  out.corner = corner;
  out.light = select(color.rgb, mix(color.rgb, vec3f(1.0, 0.95, 0.85), 0.6), core) * brightness;
  return out;
}

@fragment
fn fs(in: VertexOutput) -> @location(0) vec4f {
  let falloff = exp(-dot(in.corner, in.corner) * 4.0);
  return vec4f(in.light * falloff, 0.0);
}
`

export interface Plume {
  // Camera-relative metres; the exhaust's way (unit); the exit's radius and the plume's length.
  exit: Vec3
  way: Vec3
  radius: number
  length: number
  color: Vec3
  strength: number
}

export class EnginePlumes {
  private constructor(
    private readonly device: GPUDevice,
    private readonly pipeline: GPURenderPipeline,
    private readonly uniforms: UniformBinding,
  ) {}

  static async create(device: GPUDevice, format: GPUTextureFormat): Promise<EnginePlumes> {
    const pipeline = await createScenePipeline(device, {
      label: 'engine plume',
      code: shaderCode,
      format,
      blend: ADDITIVE_BLEND,
      primitive: { topology: 'triangle-strip', cullMode: 'none' },
      depth: { write: false, compare: 'less' },
    })
    return new EnginePlumes(device, pipeline, createUniformBinding(device, pipeline, { label: 'engine plume', floatCount: FLOATS }))
  }

  update(viewpoint: Viewpoint, plumes: readonly Plume[]): void {
    const values = new Float32Array(FLOATS)
    const view = viewpoint.view
    values.set(viewpoint.viewProjection, 0)
    values.set([view[0], view[4], view[8], 0], 16)
    values.set([view[1], view[5], view[9], 0], 20)
    plumes.slice(0, MAX_PLUMES).forEach((plume, i) => {
      values.set([...plume.exit, plume.length], 24 + i * 4)
      values.set([...plume.way, plume.radius], 24 + (MAX_PLUMES + i) * 4)
      values.set([...plume.color, plume.strength], 24 + (2 * MAX_PLUMES + i) * 4)
    })
    writeUniforms(this.device, this.uniforms, values)
  }

  draw(pass: GPURenderPassEncoder): void {
    pass.setPipeline(this.pipeline)
    pass.setBindGroup(0, this.uniforms.bindGroup)
    pass.draw(4, MAX_PLUMES * SPOTS)
  }
}
