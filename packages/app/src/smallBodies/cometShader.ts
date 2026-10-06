// Uniform layout (must match cometRenderer.ts):
//   [0..16)  viewProjection : mat4x4f
//   [16..20) cameraPosition : vec4f (xyz; w = seconds, animating the ion tail's streamers)
//   [20..24) screen         : vec4f (xy = clip units per CSS pixel, z = CSS pixels per radian)
export const COMET_UNIFORM_FLOAT_COUNT = 24

// Floats per instance: one comet's tail or its coma (see cometRenderer.ts).
export const FLOATS_PER_COMET_PART = 16

// Segments along a tail: enough for the dust tail's curve to read as smooth.
export const TAIL_SEGMENTS = 24

// A comet is three glowing parts, all additive light drawn after the opaque bodies:
// - the coma, a camera-facing glow around the nucleus, greenish from its fluorescing carbon gas,
//   with a star-like point at its heart (kept at least a few pixels wide, so a dormant comet far
//   out is still a faint dot);
// - the ion tail, a narrow blue ribbon pointing straight away from the Sun, combed into
//   streamers;
// - the dust tail, a broader, yellowish-white ribbon curving back along the orbit.
// Tails are ribbons turned around their own axis to face the camera, built from the vertex index:
// no geometry is stored, the CPU only writes each part's 16 floats per frame.
export const cometShaderCode = /* wgsl */ `
struct Uniforms {
  viewProjection: mat4x4f,
  cameraPosition: vec4f,
  screen: vec4f,
};

struct Part {
  // xyz = nucleus position, w = kind (0 = ion tail, 1 = dust tail, 2 = coma)
  @location(0) origin: vec4f,
  // tails: xyz = anti-sunward unit vector, w = length; coma: w = radius
  @location(1) axis: vec4f,
  // tails: xyz = bend (curving back along the orbit), w = width at the far end
  @location(2) bend: vec4f,
  // rgb = color, a = brightness
  @location(3) color: vec4f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  // x = along the tail (0 at the nucleus, 1 at its end) or across the coma, y = across (-1..1)
  @location(0) local: vec2f,
  @location(1) @interpolate(flat) color: vec4f,
  @location(2) @interpolate(flat) kind: f32,
};

const SEGMENTS: f32 = ${TAIL_SEGMENTS}.0;
const MIN_COMA_PX: f32 = 3.0;

@group(0) @binding(0) var<uniform> uni: Uniforms;

fn tailPoint(part: Part, s: f32) -> vec3f {
  return part.origin.xyz + part.axis.xyz * (part.axis.w * s) + part.bend.xyz * (part.axis.w * s * s);
}

fn tail(vertexIndex: u32, part: Part) -> VertexOutput {
  let s = f32(vertexIndex / 2u) / SEGMENTS;
  let side = select(-1.0, 1.0, (vertexIndex & 1u) == 1u);
  let point = tailPoint(part, s);
  let tangent = normalize(tailPoint(part, s + 0.01) - point);
  let toCamera = normalize(uni.cameraPosition.xyz - point);
  var across = cross(tangent, toCamera);
  across = across / max(length(across), 1e-4);
  let width = part.bend.w * (0.08 + 0.92 * sqrt(s));
  var out: VertexOutput;
  out.position = uni.viewProjection * vec4f(point + across * (width * side), 1.0);
  out.local = vec2f(s, side);
  out.color = part.color;
  out.kind = part.origin.w;
  return out;
}

fn coma(vertexIndex: u32, part: Part) -> VertexOutput {
  var corners = array<vec2f, 4>(vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0), vec2f(1.0, 1.0));
  let center = uni.viewProjection * vec4f(part.origin.xyz, 1.0);
  let radiusPx = part.axis.w / max(center.w, 1e-6) * uni.screen.z;
  let sizePx = max(radiusPx * 4.0, MIN_COMA_PX * 3.0);
  var out: VertexOutput;
  out.position = vec4f(center.xy + corners[vertexIndex] * sizePx * uni.screen.xy * center.w, center.z, center.w);
  // In units of the coma's radius, but never smaller than the minimum dot.
  out.local = corners[vertexIndex] * sizePx / max(radiusPx, MIN_COMA_PX);
  out.color = part.color;
  out.kind = 2.0;
  return out;
}

@vertex
fn vs(@builtin(vertex_index) vertexIndex: u32, part: Part) -> VertexOutput {
  if (part.origin.w > 1.5) {
    return coma(vertexIndex, part);
  }
  return tail(vertexIndex, part);
}

fn tailLight(in: VertexOutput) -> f32 {
  let s = in.local.x;
  let across = in.local.y;
  // Fades to nothing at the ribbon's edges and ends, so no outline shows.
  let window = pow(1.0 - across * across, 2.0) * smoothstep(0.0, 0.05, s);
  if (in.kind < 0.5) {
    // Ion tail: a thin, faint core combed into irregular streamers drifting outward.
    let drift = s * 5.0 - uni.cameraPosition.w * 0.4;
    let streamers = 0.4 + 0.6 * abs(sin(across * 7.3 + drift * 0.7) * sin(across * 17.1 + 1.3 - drift * 0.3));
    return exp(-across * across * 9.0) * streamers * window * pow(1.0 - s, 1.3);
  }
  // Dust tail: a soft fan, brightest toward its leading edge, faintly banded where dust released
  // at different times spreads out (synchronic bands).
  let fan = exp(-pow(across - 0.25, 2.0) * 3.0);
  let bands = 0.85 + 0.15 * sin(across * 6.0 + s * 9.0);
  return fan * bands * window * pow(1.0 - s, 1.8);
}

@fragment
fn fs(in: VertexOutput) -> @location(0) vec4f {
  var light: f32;
  if (in.kind > 1.5) {
    let r2 = dot(in.local, in.local);
    light = exp(-r2 * 0.35) * 0.6 + exp(-r2 * 6.0) * 1.4;
    let core = exp(-r2 * 6.0);
    return vec4f(mix(in.color.rgb, vec3f(1.0), core) * light * in.color.a, 0.0);
  }
  light = tailLight(in);
  return vec4f(in.color.rgb * light * in.color.a, 0.0);
}
`
