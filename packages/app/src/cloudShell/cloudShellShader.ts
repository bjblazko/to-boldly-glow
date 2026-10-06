// Uniform layout (must match the Float32Array packing in cloudShell.ts exactly):
//   [0..16)  worldViewProjection : mat4x4f
//   [16..32) world               : mat4x4f
//   [32..36) color               : vec4f (rgb = shell tint, from the body's own atmosphereColor;
//                                 a = base opacity scale, from atmosphereIntensity)
//   [36..40) lightDirection      : vec4f (xyz used, w unused)
//   [40..44) cameraPosition      : vec4f (xyz used, w unused; world-space, for the Fresnel term)
export const CLOUD_SHELL_UNIFORM_FLOAT_COUNT = 44

// A second, slightly-larger instance of the same shared sphere mesh every body already uses,
// alpha-blended over the opaque planet beneath it (see createCloudShellPipeline's blend state,
// identical to ringShaderCode's). No texture sampling at all - purely procedural shading, tinted by
// the body's own atmosphereColor (the same field driving the additive rim-glow term in
// litSphereShaderCode) so the shell reads as a thicker extension of the same atmospheric effect
// rather than an unrelated new color. Alpha is driven by a Fresnel term (thin looking straight down
// through the shell, thicker/more opaque toward the limb, where a grazing view ray passes through
// more of the shell's thickness) - the classic look of a real planetary atmosphere seen from space.
export const cloudShellShaderCode = /* wgsl */ `
struct Uniforms {
  worldViewProjection: mat4x4f,
  world: mat4x4f,
  color: vec4f,
  lightDirection: vec4f,
  cameraPosition: vec4f,
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
};

@group(0) @binding(0) var<uniform> uni: Uniforms;

@vertex
fn vs(vert: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  out.position = uni.worldViewProjection * vec4f(vert.position, 1.0);
  out.normal = (uni.world * vec4f(vert.normal, 0.0)).xyz;
  out.worldPosition = (uni.world * vec4f(vert.position, 1.0)).xyz;
  return out;
}

@fragment
fn fs(in: VertexOutput) -> @location(0) vec4f {
  let normal = normalize(in.normal);
  let toLight = -uni.lightDirection.xyz;
  let toCamera = normalize(uni.cameraPosition.xyz - in.worldPosition);
  let diffuse = max(dot(normal, toLight), 0.0) * 0.7 + 0.3;
  let rimFactor = pow(1.0 - max(dot(normal, toCamera), 0.0), 2.0);
  let alpha = rimFactor * uni.color.a;
  return vec4f(uni.color.rgb * diffuse, alpha);
}
`
