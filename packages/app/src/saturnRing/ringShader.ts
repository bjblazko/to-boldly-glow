// Uniform layout (must match the Float32Array packing in saturnRing.ts exactly):
//   [0..16)  worldViewProjection : mat4x4f
//   [16..32) world               : mat4x4f
//   [32..36) lightDirection      : vec4f (xyz used, w unused)
//
// A flat annulus (see ringMesh.ts) with no per-vertex normal attribute — its local normal is
// always (0,0,1) (the ring mesh lies flat in the local XY plane; local +Z is its normal, matching
// generateSphereMesh's own polar-axis convention), transformed by `world` in the fragment shader.
// Lit two-sided (abs() on the dot product) since the ring is visible from both above and below and
// cullMode is 'none'. The ring texture is a single radial gradient strip (color + transparency by
// distance from the planet, e.g. the Cassini Division gap), so texture alpha drives real
// transparency via alpha blending.
export const ringShaderCode = /* wgsl */ `
struct Uniforms {
  worldViewProjection: mat4x4f,
  world: mat4x4f,
  lightDirection: vec4f,
};

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) uv: vec2f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;
@group(0) @binding(1) var ringTexture: texture_2d<f32>;
@group(0) @binding(2) var ringSampler: sampler;

@vertex
fn vs(vert: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  out.position = uni.worldViewProjection * vec4f(vert.position, 1.0);
  out.uv = vert.uv;
  return out;
}

@fragment
fn fs(in: VertexOutput) -> @location(0) vec4f {
  let sampled = textureSample(ringTexture, ringSampler, in.uv);
  let normal = normalize((uni.world * vec4f(0.0, 0.0, 1.0, 0.0)).xyz);
  let brightness = abs(dot(normal, -uni.lightDirection.xyz)) * 0.85 + 0.15;
  return vec4f(sampled.rgb * brightness, sampled.a);
}
`
