// Uniform layout: [0..16) worldViewProjection : mat4x4f, [16..20) color : vec4f
export const unlitSphereShaderCode = /* wgsl */ `
struct Uniforms {
  worldViewProjection: mat4x4f,
  color: vec4f,
};

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;
@group(0) @binding(1) var bodyTexture: texture_2d<f32>;
@group(0) @binding(2) var bodySampler: sampler;

@vertex
fn vs(vert: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  out.position = uni.worldViewProjection * vec4f(vert.position, 1.0);
  out.uv = vert.uv;
  return out;
}

@fragment
fn fs(in: VertexOutput) -> @location(0) vec4f {
  let sampled = textureSample(bodyTexture, bodySampler, in.uv);
  return vec4f(sampled.rgb * uni.color.rgb, uni.color.a);
}
`
