// Uniform layout (must match the packing in asteroidBelt.ts):
//   [0..16)  viewProjection : mat4x4f
//   [16..32) view           : mat4x4f (lights the close-up rocks in view space)
//   [32..36) cameraPosition : vec4f (xyz)
//   [36..40) orbitClock     : vec4f (x = days since J2000, y = scale blend, z = scene units per AU at
//                            Realistic scale, w = Compact scale's log1p distance factor)
//   [40..44) screen         : vec4f (xy = clip units per CSS pixel, z = CSS pixels per radian, w = brightness)
//   [44..48) sizing         : vec4f (x = scene units per km at Realistic scale, y = Compact size per sqrt(km))
export const ASTEROID_UNIFORM_FLOAT_COUNT = 48

// Every asteroid is one instance: its orbit goes to the GPU once, and each frame the vertex shader
// solves Kepler's equation for this moment - so thousands of bodies move on their own real orbits
// at any time scale, for the cost of one draw call and no per-frame CPU work. Distances follow the
// Realistic/Compact blend exactly as sceneScale.ts scales the planets.
//
// From afar an asteroid is a dot of reflected sunlight, brighter when the Sun is behind the camera
// (full phase); thousands of them draw the belts. Up close, one grows into a lit, lumpy rock - a
// sphere impostor with a wobbly outline, shaded by the Sun in view space - and the large, round
// dwarf planets into lit balls.
export const asteroidShaderCode = /* wgsl */ `
struct Uniforms {
  viewProjection: mat4x4f,
  view: mat4x4f,
  cameraPosition: vec4f,
  orbitClock: vec4f,
  screen: vec4f,
  sizing: vec4f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) offsetPx: vec2f,
  // x = apparent radius (px), y = lumpiness, z = shape seed, w = dot brightness
  @location(1) @interpolate(flat) look: vec4f,
  @location(2) @interpolate(flat) color: vec3f,
  @location(3) @interpolate(flat) sunInView: vec3f,
};

const PI: f32 = 3.14159265;
const TWO_PI: f32 = 6.2831853;
const GAUSSIAN_GRAVITATIONAL_CONSTANT: f32 = 0.01720209895;
const DOT_RADIUS_PX: f32 = 1.4;

@group(0) @binding(0) var<uniform> uni: Uniforms;

// Heliocentric position (AU, ecliptic frame) of a Keplerian orbit at the uniform's time.
fn orbitPosition(shape: vec4f, orientation: vec4f) -> vec3f {
  let a = shape.x;
  let e = shape.y;
  let meanMotion = GAUSSIAN_GRAVITATIONAL_CONSTANT / (a * sqrt(a));
  var meanAnomaly = orientation.y + meanMotion * uni.orbitClock.x;
  meanAnomaly = meanAnomaly - TWO_PI * floor(meanAnomaly / TWO_PI + 0.5);
  var E = meanAnomaly + e * sin(meanAnomaly);
  for (var iteration = 0; iteration < 6; iteration++) {
    E = E - (E - e * sin(E) - meanAnomaly) / (1.0 - e * cos(E));
  }
  let inPlane = vec2f(a * (cos(E) - e), a * sqrt(1.0 - e * e) * sin(E));
  let w = orientation.x;
  let atNode = vec2f(cos(w) * inPlane.x - sin(w) * inPlane.y, sin(w) * inPlane.x + cos(w) * inPlane.y);
  let ci = cos(shape.z);
  let node = shape.w;
  return vec3f(
    cos(node) * atNode.x - sin(node) * ci * atNode.y,
    sin(node) * atNode.x + cos(node) * ci * atNode.y,
    sin(shape.z) * atNode.y,
  );
}

fn toScene(au: vec3f) -> vec3f {
  let distanceAu = max(length(au), 1e-6);
  let realistic = distanceAu * uni.orbitClock.z;
  let compact = uni.orbitClock.w * log(1.0 + distanceAu);
  return au * (mix(realistic, compact, uni.orbitClock.y) / distanceAu);
}

@vertex
fn vs(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32,
  @location(0) shape: vec4f,
  @location(1) orientation: vec4f,
) -> VertexOutput {
  var corners = array<vec2f, 4>(vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0), vec2f(1.0, 1.0));
  let au = orbitPosition(shape, orientation);
  let heliocentricAu = length(au);
  let world = toScene(au);
  let radiusKm = orientation.z;
  let realisticRadius = radiusKm * uni.sizing.x;
  let compactRadius = uni.sizing.y * sqrt(radiusKm);
  let radius = realisticRadius * pow(compactRadius / realisticRadius, uni.orbitClock.y);

  let toCamera = uni.cameraPosition.xyz - world;
  let distance = max(length(toCamera), 1e-6);
  let radiusPx = radius / distance * uni.screen.z;
  let halfSizePx = max(radiusPx, DOT_RADIUS_PX) * 1.25 + 1.0;
  let offsetPx = corners[vertexIndex] * halfSizePx;

  let toSun = normalize(-world);
  // Sunlight thins out with distance: the Kuiper belt is a faint haze next to the main belt.
  let sunlit = clamp(2.8 / max(heliocentricAu, 0.1), 0.05, 1.2);
  // Full phase (Sun behind the camera) is brightest; a crescent seen against the Sun barely shows.
  let phase = 0.5 + 0.5 * dot(toSun, toCamera / distance);
  let size = clamp(log(radiusKm + 1.0) / log(100.0), 0.0, 1.0);

  let center = uni.viewProjection * vec4f(world, 1.0);
  var out: VertexOutput;
  out.position = vec4f(center.xy + offsetPx * uni.screen.xy * center.w, center.z, center.w);
  out.offsetPx = offsetPx;
  out.look = vec4f(radiusPx, clamp(1.0 - radiusKm / 250.0, 0.0, 1.0), f32(instanceIndex % 997u) * 0.37, (0.25 + 0.75 * size) * phase * sunlit * uni.screen.w);
  out.color = mix(vec3f(0.5, 0.5, 0.53), vec3f(0.74, 0.56, 0.42), orientation.w);
  out.sunInView = normalize((uni.view * vec4f(toSun, 0.0)).xyz);
  return out;
}

// A lit rock: a sphere impostor whose outline wobbles with a few harmonics of the angle.
fn rock(in: VertexOutput) -> vec4f {
  let radiusPx = in.look.x;
  let angle = atan2(in.offsetPx.y, in.offsetPx.x);
  let seed = in.look.z;
  let wobble = 0.5 + 0.25 * sin(3.0 * angle + seed) + 0.15 * sin(5.0 * angle + seed * 2.3) + 0.1 * sin(2.0 * angle + seed * 4.1);
  let edge = radiusPx * (1.0 - 0.3 * in.look.y * wobble);
  let r = length(in.offsetPx) / edge;
  let coverage = 1.0 - smoothstep(1.0 - 1.5 / edge, 1.0, r);
  if (coverage <= 0.0) {
    discard;
  }
  let onDisk = in.offsetPx / edge;
  let normal = normalize(vec3f(onDisk, sqrt(max(1.0 - dot(onDisk, onDisk), 0.0))));
  let light = max(dot(normal, in.sunInView), 0.0) * 1.1 + 0.015;
  return vec4f(in.color * light * coverage, coverage);
}

@fragment
fn fs(in: VertexOutput) -> @location(0) vec4f {
  if (in.look.x > 2.5) {
    return rock(in);
  }
  let glow = exp(-dot(in.offsetPx, in.offsetPx) / (2.0 * 0.55 * 0.55));
  let rockFade = smoothstep(1.0, 2.5, in.look.x);
  let light = in.look.w * glow * (1.0 - rockFade) + glow * rockFade * 0.5;
  return vec4f(in.color * light, light * 0.5);
}
`
