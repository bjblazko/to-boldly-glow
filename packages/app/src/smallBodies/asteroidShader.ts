import { ROCK_MIN_RADIUS_PX } from './asteroidCompute'

// Uniform layout of both draws (must match asteroidBelt.ts):
//   [0..16)  viewProjection : mat4x4f
//   [16..32) view           : mat4x4f (lights the close-up rocks in view space)
//   [32..36) cameraPosition : vec4f (xyz)
//   [36..40) scale          : vec4f (y = scale blend)
//   [40..44) screen         : vec4f (xy = clip units per CSS pixel, z = CSS pixels per radian, w = brightness)
//   [44..48) sizing         : vec4f (x = scene units per km at Realistic scale, y = Compact size per sqrt(km))
export const ASTEROID_UNIFORM_FLOAT_COUNT = 48

// From afar an asteroid is a dot of reflected sunlight, brighter when the Sun is behind the camera
// (full phase); thousands of them draw the belts. Up close, one grows into a lit, lumpy rock - a
// sphere impostor with a wobbly outline, shaded by the Sun in view space - and the large, round
// dwarf planets into lit balls.
export const asteroidShaderCode = /* wgsl */ `
struct Uniforms {
  viewProjection: mat4x4f,
  view: mat4x4f,
  cameraPosition: vec4f,
  scale: vec4f,
  screen: vec4f,
  sizing: vec4f,
};

struct RockOutput {
  @builtin(position) position: vec4f,
  @location(0) offsetPx: vec2f,
  // x = apparent radius (px), y = lumpiness, z = shape seed, w = dot brightness
  @location(1) @interpolate(flat) look: vec4f,
  @location(2) @interpolate(flat) color: vec3f,
  @location(3) @interpolate(flat) sunInView: vec3f,
};

struct PointOutput {
  @builtin(position) position: vec4f,
  @location(0) @interpolate(flat) color: vec3f,
};

// A rock's quad reaches a little past its outline, for the antialiased edge.
const MIN_HALF_SIZE_PX: f32 = 1.8;

@group(0) @binding(0) var<uniform> uni: Uniforms;

// What an asteroid looks like from here: its radius on screen (px), and how bright its point of
// light is - brightest at full phase (Sun behind the camera), fainter far from the Sun (the Kuiper
// belt is a faint haze next to the main belt), brighter for larger bodies.
fn appearance(orientation: vec4f, placed: vec4f) -> vec2f {
  let radiusKm = orientation.z;
  let realisticRadius = radiusKm * uni.sizing.x;
  let compactRadius = uni.sizing.y * sqrt(radiusKm);
  let radius = realisticRadius * pow(compactRadius / realisticRadius, uni.scale.y);
  let toCamera = uni.cameraPosition.xyz - placed.xyz;
  let distance = max(length(toCamera), 1e-6);
  let sunlit = clamp(2.8 / max(placed.w, 0.1), 0.05, 1.2);
  let phase = 0.5 + 0.5 * dot(normalize(-placed.xyz), toCamera / distance);
  let size = clamp(log(radiusKm + 1.0) / log(100.0), 0.0, 1.0);
  return vec2f(radius / distance * uni.screen.z, (0.25 + 0.75 * size) * phase * sunlit * uni.screen.w);
}

fn asteroidColor(orientation: vec4f) -> vec3f {
  return mix(vec3f(0.5, 0.5, 0.53), vec3f(0.74, 0.56, 0.42), orientation.w);
}

// The distant majority: one point of light each, in a single non-instanced draw. Those big enough
// on screen to be rocks are left out here (moved outside the view) and drawn by vsRock instead.
@vertex
fn vsPoint(@location(0) orientation: vec4f, @location(1) placed: vec4f) -> PointOutput {
  let look = appearance(orientation, placed);
  var out: PointOutput;
  out.position = select(uni.viewProjection * vec4f(placed.xyz, 1.0), vec4f(2.0, 2.0, 2.0, 1.0), look.x >= ${ROCK_MIN_RADIUS_PX.toFixed(1)});
  out.color = asteroidColor(orientation) * look.y * 1.6;
  return out;
}

@fragment
fn fsPoint(in: PointOutput) -> @location(0) vec4f {
  return vec4f(in.color, 0.0);
}

// The near few (see the rock list compute pass), each a camera-facing quad.
@vertex
fn vsRock(@builtin(vertex_index) vertexIndex: u32, @location(0) orientation: vec4f, @location(1) placed: vec4f) -> RockOutput {
  var corners = array<vec2f, 4>(vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0), vec2f(1.0, 1.0));
  let look = appearance(orientation, placed);
  let radiusPx = look.x;
  let offsetPx = corners[vertexIndex] * max(radiusPx * 1.25 + 1.0, MIN_HALF_SIZE_PX);
  let center = uni.viewProjection * vec4f(placed.xyz, 1.0);
  var out: RockOutput;
  out.position = vec4f(center.xy + offsetPx * uni.screen.xy * center.w, center.z, center.w);
  out.offsetPx = offsetPx;
  // The shape seed comes from the orbit, so each rock keeps its outline frame after frame.
  out.look = vec4f(radiusPx, clamp(1.0 - orientation.z / 250.0, 0.0, 1.0), fract(orientation.y * 7.31) * 6.28, look.y);
  out.color = asteroidColor(orientation);
  out.sunInView = normalize((uni.view * vec4f(normalize(-placed.xyz), 0.0)).xyz);
  return out;
}

// A lit rock: a sphere impostor whose outline wobbles with a few harmonics of the angle. While it
// is still only a pixel or two across, it fades in from the point of light it was.
@fragment
fn fsRock(in: RockOutput) -> @location(0) vec4f {
  let radiusPx = in.look.x;
  let angle = atan2(in.offsetPx.y, in.offsetPx.x);
  let seed = in.look.z;
  let wobble = 0.5 + 0.25 * sin(3.0 * angle + seed) + 0.15 * sin(5.0 * angle + seed * 2.3) + 0.1 * sin(2.0 * angle + seed * 4.1);
  let edge = max(radiusPx * (1.0 - 0.3 * in.look.y * wobble), 0.75);
  let r = length(in.offsetPx) / edge;
  let coverage = 1.0 - smoothstep(1.0 - 1.5 / edge, 1.0, r);
  if (coverage <= 0.0) {
    discard;
  }
  let onDisk = in.offsetPx / edge;
  let normal = normalize(vec3f(onDisk, sqrt(max(1.0 - dot(onDisk, onDisk), 0.0))));
  let lit = in.color * (max(dot(normal, in.sunInView), 0.0) * 1.1 + 0.015);
  let pointLike = 1.0 - smoothstep(1.0, 2.5, radiusPx);
  let color = mix(lit, in.color * in.look.w * 1.6, pointLike);
  return vec4f(color * coverage, coverage * (1.0 - pointLike));
}
`
