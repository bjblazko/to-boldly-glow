// Uniform float count for sunShaderCode's Uniforms struct, shared with the packing in sunSurface.ts.
export const SUN_UNIFORM_FLOAT_COUNT = 44

// Uniform layout (must match the Float32Array packing in sunSurface.ts exactly):
//   [0..16)  worldViewProjection : mat4x4f
//   [16..32) world               : mat4x4f
//   [32..36) color               : vec4f
//   [36..40) cameraPosition      : vec4f (xyz used; world-space, for how far toward the limb a point lies)
//   [40..44) granulation         : vec4f (x/y = seeds of two generations of granules, z = phase
//                                 of their staggered lives (0-1), w = contrast; see sunSurface.ts)
//
// The Sun shines by its own light, so nothing lights it. Two things make it a glowing ball of gas
// rather than a flat disc: limb darkening - toward the edge the eye looks into higher, cooler
// layers, so the disc dims and reddens - and granulation, the tops of convection cells about
// 1,300 km across that boil up and fade away within minutes.
export const sunShaderCode = /* wgsl */ `
struct Uniforms {
  worldViewProjection: mat4x4f,
  world: mat4x4f,
  color: vec4f,
  cameraPosition: vec4f,
  granulation: vec4f,
};

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) surfacePoint: vec3f,
  @location(2) worldPosition: vec3f,
  @location(3) worldNormal: vec3f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;
@group(0) @binding(1) var bodyTexture: texture_2d<f32>;
@group(0) @binding(2) var bodySampler: sampler;

// Limb darkening per color channel (red ~650 nm, green ~550 nm, blue ~450 nm) in the quadratic law
// I(mu)/I(1) = 1 - u (1 - mu) - v (1 - mu^2), with mu the cosine of the angle between the line of
// sight and the surface normal; u and v from Allen's Astrophysical Quantities. The very edge keeps
// about 38% of the center's red light but only 18% of its blue.
const LIMB_U = vec3f(0.84, 0.93, 0.99);
const LIMB_V = vec3f(-0.23, -0.23, -0.17);

// Granules per Sun radius: the Sun's radius (696,000 km) over a granule's size (~1,300 km).
const GRANULES_PER_RADIUS: f32 = 535.0;
// Mean and standard deviation of granules() below over the sphere (measured numerically), to
// turn it into a pattern of mean 0 and spread 1 that the contrast uniform then scales.
const GRANULES_MEAN: f32 = 0.44;
const GRANULES_SPREAD: f32 = 0.33;

fn limbDarkening(mu: f32) -> vec3f {
  let m = clamp(mu, 0.0, 1.0);
  return vec3f(1.0) - LIMB_U * (1.0 - m) - LIMB_V * (1.0 - m * m);
}

fn hash33(p: vec3f) -> vec3f {
  var q = fract(p * vec3f(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yxz + 33.33);
  return fract((q.xxy + q.yxx) * q.zyx);
}

// One generation of granules: bright cell centers parted by dark lanes where two cells meet (a
// Worley pattern, in granule units). Returns about 0 in a lane, up to 1 at a cell's center.
fn granules(p: vec3f, seed: f32) -> f32 {
  let cell = floor(p);
  var nearest = 8.0;
  var second = 8.0;
  for (var i = 0; i < 27; i = i + 1) {
    let neighbor = cell + vec3f(f32(i % 3 - 1), f32((i / 3) % 3 - 1), f32(i / 9 - 1));
    let distanceToCenter = distance(p, neighbor + hash33(neighbor + vec3f(seed * 1031.0, 0.0, 0.0)));
    second = select(min(second, distanceToCenter), nearest, distanceToCenter < nearest);
    nearest = min(nearest, distanceToCenter);
  }
  return smoothstep(0.0, 0.3, second - nearest) * (1.0 - 0.4 * nearest);
}

// Brightness around 1: two generations of granules half a lifetime apart, one fading out while the
// other boils up, weighted so the pattern keeps its contrast through the handover. Each generation
// gets a new seed while its weight is zero, so the pattern never jumps.
fn granulation(surfacePoint: vec3f, pixelFootprint: f32) -> f32 {
  let p = normalize(surfacePoint) * GRANULES_PER_RADIUS;
  let weightA = cos(3.14159265 * uni.granulation.z) * cos(3.14159265 * uni.granulation.z);
  let weightB = 1.0 - weightA;
  let a = (granules(p, uni.granulation.x) - GRANULES_MEAN) / GRANULES_SPREAD;
  let b = (granules(p, uni.granulation.y) - GRANULES_MEAN) / GRANULES_SPREAD;
  let mixed = (weightA * a + weightB * b) / sqrt(weightA * weightA + weightB * weightB);
  // Granules smaller than a pixel would only flicker: they fade out as the camera backs away.
  let resolved = 1.0 - smoothstep(0.25, 0.6, pixelFootprint * GRANULES_PER_RADIUS);
  return 1.0 + uni.granulation.w * resolved * mixed;
}

@vertex
fn vs(vert: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  out.position = uni.worldViewProjection * vec4f(vert.position, 1.0);
  out.uv = vert.uv;
  out.surfacePoint = vert.position;
  out.worldPosition = (uni.world * vec4f(vert.position, 1.0)).xyz;
  out.worldNormal = (uni.world * vec4f(vert.normal, 0.0)).xyz;
  return out;
}

@fragment
fn fs(in: VertexOutput) -> @location(0) vec4f {
  // Outside any branch: derivatives need every pixel of the quad.
  let pixelFootprint = length(fwidth(in.surfacePoint));
  let sampled = textureSample(bodyTexture, bodySampler, in.uv);
  let toCamera = normalize(uni.cameraPosition.xyz - in.worldPosition);
  let mu = dot(normalize(in.worldNormal), toCamera);
  let surface = granulation(in.surfacePoint, pixelFootprint);
  return vec4f(sampled.rgb * uni.color.rgb * limbDarkening(mu) * surface, uni.color.a);
}
`
