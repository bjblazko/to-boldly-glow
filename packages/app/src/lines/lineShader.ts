// Uniform layout: [0..16) worldViewProjection : mat4x4f, [16..20) color : vec4f,
// [20..24) dashParams : vec4f (x = dash length in world units [dash mode] or unused [glow mode],
// y = animated dash offset in world units [dash mode] or the current pulse phase in radians [glow
// mode], z = duty cycle 0..1 [dash mode] or unused [glow mode], w = 0.0 solid / 1.0 dashed / 2.0
// pulsing glow).
export const LINE_UNIFORM_FLOAT_COUNT = 24

// Shared by orbit paths (dashParams.w = 0, solid), learn-mode axis/equator overlays (dashParams.w =
// 2, pulsing glow - a smoothly oscillating alpha, no marching-ants offset), and any future dashed
// use (dashParams.w = 1, kept for orbit-path-style solid/dashed rendering) - one pipeline, one
// shader, gated by a uniform flag rather than near-duplicate shaders.
export const lineShaderCode = /* wgsl */ `
struct Uniforms {
  worldViewProjection: mat4x4f,
  color: vec4f,
  dashParams: vec4f,
};

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) lineDistance: f32,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) lineDistance: f32,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;

@vertex
fn vs(vert: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  out.position = uni.worldViewProjection * vec4f(vert.position, 1.0);
  out.lineDistance = vert.lineDistance;
  return out;
}

@fragment
fn fs(in: VertexOutput) -> @location(0) vec4f {
  if (uni.dashParams.w > 1.5) {
    // Pulsing glow: alpha oscillates smoothly between 70% and 100% of the base color's own alpha -
    // never fully invisible (unlike the dash mode's hard on/off), reading as a soft pulse rather
    // than a marching pattern.
    let pulse = 0.85 + 0.15 * sin(uni.dashParams.y);
    return vec4f(uni.color.rgb, uni.color.a * pulse);
  }
  if (uni.dashParams.w > 0.5) {
    let dashLength = max(uni.dashParams.x, 0.0001);
    let phase = fract((in.lineDistance - uni.dashParams.y) / dashLength);
    if (phase > uni.dashParams.z) {
      discard;
    }
  }
  return uni.color;
}
`
