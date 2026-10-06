import { cloudCoverWgsl } from './cloudCoverWgsl'

// Uniform layout (packed by cloudLayer.ts):
//   [0..16)  worldViewProjection : mat4x4f
//   [16..32) world               : mat4x4f
//   [32..36) lightDirection      : vec4f (xyz used)
//   [36..40) cameraPosition      : vec4f (xyz used)
//   [40..44) params              : vec4f (x = time in seconds, y = opacity, zw unused)
export const CLOUD_LAYER_UNIFORM_FLOAT_COUNT = 44

// Earth's clouds on a sphere just above its surface, turning with the planet: bright white by day,
// warmer at the terminator, gone at night, and a little denser toward the limb, where the view
// passes through more of them.
export const cloudLayerShaderCode = /* wgsl */ `
struct Uniforms {
  worldViewProjection: mat4x4f,
  world: mat4x4f,
  lightDirection: vec4f,
  cameraPosition: vec4f,
  params: vec4f,
};

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
  @location(1) worldPosition: vec3f,
  @location(2) localDirection: vec3f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;

${cloudCoverWgsl}

@vertex
fn vs(vert: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  out.position = uni.worldViewProjection * vec4f(vert.position, 1.0);
  out.normal = (uni.world * vec4f(vert.normal, 0.0)).xyz;
  out.worldPosition = (uni.world * vec4f(vert.position, 1.0)).xyz;
  out.localDirection = vert.position;
  return out;
}

@fragment
fn fs(in: VertexOutput) -> @location(0) vec4f {
  let normal = normalize(in.normal);
  let toLight = -uni.lightDirection.xyz;
  let toCamera = normalize(uni.cameraPosition.xyz - in.worldPosition);
  let cover = cloudCover(normalize(in.localDirection), uni.params.x);
  let incidence = dot(normal, toLight);
  let daylight = smoothstep(-0.08, 0.2, incidence);
  let dusk = smoothstep(-0.08, 0.02, incidence) * (1.0 - smoothstep(0.02, 0.2, incidence));
  let color = mix(vec3f(1.0), vec3f(1.0, 0.7, 0.5), dusk * 0.6) * (daylight * 0.95 + 0.01);
  let limb = mix(1.0, 1.35, pow(1.0 - max(dot(normal, toCamera), 0.0), 2.0));
  return vec4f(color, min(cover * uni.params.y * limb, 1.0) * smoothstep(-0.15, 0.05, incidence));
}
`
