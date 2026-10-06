// Uniform layout (must match the Float32Array packing in atmosphereShell.ts exactly):
//   [0..16)  worldViewProjection : mat4x4f
//   [16..32) world               : mat4x4f
//   [32..36) color               : vec4f (rgb = shell tint, from the body's own atmosphereColor;
//                                 a = base opacity scale, from atmosphereIntensity)
//   [36..40) lightDirection      : vec4f (xyz used, w unused)
//   [40..44) cameraPosition      : vec4f (xyz used, w unused; world-space, for the Fresnel term)
//   [44..48) profile             : vec4f (x = rim exponent, y = light on the night side,
//                                 z = 1 to fade the shell out on the night side, w unused)
//   [48..52) sunset              : vec4f (rgb = the shell's color along the terminator, a = strength)
export const ATMOSPHERE_SHELL_UNIFORM_FLOAT_COUNT = 52

// A second, slightly-larger instance of the same shared sphere mesh every body already uses,
// alpha-blended over the opaque planet beneath it. No texture sampling at all - purely procedural
// shading, tinted by the body's own atmosphereColor (the same field driving the rim-glow term in
// the lit body shader) so the shell reads as a thicker extension of the same atmospheric effect.
// Alpha is driven by a Fresnel term: thin looking straight down through the shell, thicker toward
// the limb, where a grazing view ray passes through more of it - and beyond the planet's own edge,
// a glowing halo. A gas giant's deep atmosphere still shows faintly on its night side; a thin one
// like Earth's lights up only where the Sun shines on it, turning sunset-colored at the terminator.
export const atmosphereShellShaderCode = /* wgsl */ `
struct Uniforms {
  worldViewProjection: mat4x4f,
  world: mat4x4f,
  color: vec4f,
  lightDirection: vec4f,
  cameraPosition: vec4f,
  profile: vec4f,
  sunset: vec4f,
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
  let incidence = dot(normal, toLight);
  let nightLight = uni.profile.y;
  let diffuse = max(incidence, 0.0) * (1.0 - nightLight) + nightLight;
  let rimFactor = pow(1.0 - max(dot(normal, toCamera), 0.0), uni.profile.x);
  let daylight = mix(1.0, smoothstep(-0.2, 0.15, incidence), uni.profile.z);
  let sunset = smoothstep(-0.2, 0.0, incidence) * (1.0 - smoothstep(0.0, 0.3, incidence)) * uni.sunset.a;
  let tint = mix(uni.color.rgb, uni.sunset.rgb, sunset);
  return vec4f(tint * max(diffuse, sunset), rimFactor * uni.color.a * daylight);
}
`
