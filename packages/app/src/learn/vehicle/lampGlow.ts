import type { Viewpoint } from '../../camera/viewpoint'
import { createUniformBinding, writeUniforms, type UniformBinding } from '../../gpu/buffers'
import { ADDITIVE_BLEND, createScenePipeline } from '../../gpu/scenePipeline'
import type { Lamp } from '../../spacecraft/modelRenderer'
import { MAX_LAMPS } from '../../spacecraft/modelShader'

// The lamps themselves, so one sees where a cabin's light comes from: a small soft glow at each,
// brighter than white so the bloom pass makes it shine. Drawn after the models, hidden behind what
// stands in front of it (depth tested, not written), added onto the picture.

// How large a glow is (metres across) and how bright its middle (the bloom starts above 1).
const GLOW_SIZE = 0.06
const GLOW_BRIGHTNESS = 3.0

// viewProjection, the camera's right and up, then per lamp its place and its colour.
const GLOW_UNIFORM_FLOAT_COUNT = 16 + 4 + 4 + MAX_LAMPS * 8

const glowShaderCode = /* wgsl */ `
struct Uniforms {
  viewProjection: mat4x4f,
  right: vec4f,
  up: vec4f,
  places: array<vec4f, ${MAX_LAMPS}>,
  colors: array<vec4f, ${MAX_LAMPS}>,
}

@group(0) @binding(0) var<uniform> uni: Uniforms;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) corner: vec2f,
  @location(1) @interpolate(flat) lamp: u32,
}

@vertex
fn vs(@builtin(vertex_index) vertexIndex: u32, @builtin(instance_index) lamp: u32) -> VertexOutput {
  var corners = array<vec2f, 4>(vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0), vec2f(1.0, 1.0));
  let corner = corners[vertexIndex];
  let size = select(0.0, ${GLOW_SIZE / 2}, uni.places[lamp].w > 0.0);
  let world = uni.places[lamp].xyz + (uni.right.xyz * corner.x + uni.up.xyz * corner.y) * size;
  var out: VertexOutput;
  out.position = uni.viewProjection * vec4f(world, 1.0);
  out.corner = corner;
  out.lamp = lamp;
  return out;
}

@fragment
fn fs(in: VertexOutput) -> @location(0) vec4f {
  let falloff = exp(-dot(in.corner, in.corner) * 5.0);
  return vec4f(normalize(uni.colors[in.lamp].rgb) * ${GLOW_BRIGHTNESS.toFixed(1)} * falloff, 0.0);
}
`

export class LampGlow {
  private constructor(
    private readonly device: GPUDevice,
    private readonly pipeline: GPURenderPipeline,
    private readonly uniforms: UniformBinding,
  ) {}

  static async create(device: GPUDevice, format: GPUTextureFormat): Promise<LampGlow> {
    const pipeline = await createScenePipeline(device, {
      label: 'lamp glow',
      code: glowShaderCode,
      format,
      blend: ADDITIVE_BLEND,
      primitive: { topology: 'triangle-strip', cullMode: 'none' },
      depth: { write: false, compare: 'less' },
    })
    return new LampGlow(device, pipeline, createUniformBinding(device, pipeline, { label: 'lamp glow', floatCount: GLOW_UNIFORM_FLOAT_COUNT }))
  }

  update(viewpoint: Viewpoint, lamps: readonly Lamp[]): void {
    const values = new Float32Array(GLOW_UNIFORM_FLOAT_COUNT)
    const view = viewpoint.view
    values.set(viewpoint.viewProjection, 0)
    values.set([view[0], view[4], view[8], 0], 16)
    values.set([view[1], view[5], view[9], 0], 20)
    lamps.slice(0, MAX_LAMPS).forEach((lamp, index) => {
      values.set([...lamp.place, 1], 24 + index * 4)
      values.set([...lamp.color, 0], 24 + (MAX_LAMPS + index) * 4)
    })
    writeUniforms(this.device, this.uniforms, values)
  }

  draw(pass: GPURenderPassEncoder): void {
    pass.setPipeline(this.pipeline)
    pass.setBindGroup(0, this.uniforms.bindGroup)
    pass.draw(4, MAX_LAMPS)
  }
}
