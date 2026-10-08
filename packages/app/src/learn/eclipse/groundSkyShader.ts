// Uniform layout (must match the packing in groundSky.ts):
//   [0..16)  inverseRotationViewProjection : mat4x4f (clip space back to a view ray, translation-free)
//   [16..20) zenith    : vec4f (xyz = straight up from the observer; w = daylight, 0-1)
//   [20..24) towardSun : vec4f (xyz = unit direction to the Sun; w = the Sun's angular radius)
//   [24..28) north     : vec4f (xyz = a level direction, where the horizon's hills are counted from;
//                       w = the totality glow along the horizon, 0-1)
//   [28..32) params    : vec4f (x = eclipse glasses, 0-1; y = how far the glasses scale the Sun's
//                       light; z = how much of the stars and the Milky Way the daylight hides, 0-1)
//   [32..36) diamond   : vec4f (xyz = direction of the Sun's last sliver; w = its glint, 0-1)
export const GROUND_SKY_UNIFORM_FLOAT_COUNT = 36

// The eclipse lesson's view from the ground, in three fullscreen passes sharing one vertex stage:
// - fsDimBackdrop, right after the stars and the Milky Way: daylight hides them.
// - fsSky, after the Sun, Moon and corona: the air's own light, added in front of everything above
//   the horizon - so the Moon's dark disc vanishes into the blue sky except where it covers the Sun,
//   just as it does in a real partial eclipse - and an opaque ground with low hills below it. As the
//   Sun disappears the blue fades to the deep blue of totality, and the horizon glows all around
//   like a sunset: that light comes from beyond the Moon's shadow, tens of kilometers away.
//   Just before and after totality, the last sliver of the Sun glints like a diamond: far brighter
//   than anything else in the sky, it floods the eye (and every camera) with glare and rays.
// - fsGlasses, last: eclipse glasses, which pass only the Sun itself, dimmed and orange-tinted.
export const groundSkyShaderCode = /* wgsl */ `
struct Uniforms {
  inverseRotationViewProjection: mat4x4f,
  zenith: vec4f,
  towardSun: vec4f,
  north: vec4f,
  params: vec4f,
  diamond: vec4f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) ray: vec3f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;

const DAY_HORIZON = vec3f(0.3, 0.47, 0.78);
const DAY_ZENITH = vec3f(0.05, 0.16, 0.55);
const AUREOLE = vec3f(1.0, 0.9, 0.75);
const DISTANT_HILLS = vec3f(0.16, 0.24, 0.36);
const NEAR_LAND = vec3f(0.035, 0.05, 0.03);
const TOTALITY_SKY = vec3f(0.008, 0.014, 0.04);
const SUNSET_GLOW = vec3f(1.0, 0.48, 0.17);
const TWILIGHT_BAND = vec3f(0.42, 0.32, 0.5);
const GLASSES_TINT = vec3f(1.0, 0.66, 0.32);
const GLINT = vec3f(1.0, 0.97, 0.92);

@vertex
fn vs(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var positions = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  let point = uni.inverseRotationViewProjection * vec4f(positions[vertexIndex], 0.5, 1.0);
  var out: VertexOutput;
  out.position = vec4f(positions[vertexIndex], 0.0, 1.0);
  out.ray = point.xyz / point.w;
  return out;
}

@fragment
fn fsDimBackdrop(in: VertexOutput) -> @location(0) vec4f {
  return vec4f(0.0, 0.0, 0.0, uni.params.z);
}

// A smooth, gently uneven skyline (0-1) around the horizon.
fn hills(x: f32) -> f32 {
  return 0.5 + 0.24 * sin(x) + 0.16 * sin(2.3 * x + 1.7) + 0.1 * sin(5.1 * x + 0.4);
}

// By day: blue, paler toward the horizon, with a bright aureole around the Sun - and the Sun's own
// glare, so dazzling that the bite the Moon takes out of it can't be seen with the naked eye.
fn skyColor(altitude: f32, angleToSun: f32) -> vec3f {
  let up = max(altitude, 0.0);
  let daylight = uni.zenith.w;
  let glare = AUREOLE * 5.0 * exp(-angleToSun / (uni.towardSun.w * 0.8)) * daylight;
  let day = mix(DAY_HORIZON, DAY_ZENITH, smoothstep(0.0, 0.6, up)) + AUREOLE * 0.45 * exp(-angleToSun / 0.07) + glare;
  let glow = SUNSET_GLOW * 0.3 * exp(-up / 0.05) + TWILIGHT_BAND * 0.05 * exp(-up / 0.22) + TOTALITY_SKY;
  return day * daylight + glow * uni.north.w * (1.0 - daylight);
}

// The diamond's glare: a blinding core, a halo and four rays.
fn diamondGlint(direction: vec3f) -> vec3f {
  let strength = uni.diamond.w;
  if (strength <= 0.0) {
    return vec3f(0.0);
  }
  let glint = uni.diamond.xyz;
  let along = dot(direction, glint);
  let angle = acos(clamp(along, -1.0, 1.0));
  let across = normalize(cross(glint, uni.zenith.xyz));
  let offset = direction - glint * along;
  let turn = atan2(dot(offset, cross(across, glint)), dot(offset, across));
  let core = exp(-pow(angle / 0.006, 2.0)) * 12.0 + exp(-angle / 0.018) * 1.2;
  let rays = pow(abs(cos(2.0 * turn + 0.4)), 120.0) * exp(-angle / 0.05) * 1.5;
  return GLINT * (core + rays) * strength;
}

// The skyline's two ranges of hills; returns (coverage, how much of it is the nearer range).
fn ground(direction: vec3f, altitude: f32) -> vec2f {
  let zenith = uni.zenith.xyz;
  let north = uni.north.xyz;
  let azimuth = atan2(dot(direction, cross(zenith, north)), dot(direction, north));
  let far = 0.012 + 0.03 * hills(azimuth * 5.0);
  let near = 0.003 + 0.012 * hills(azimuth * 13.0 + 7.0);
  let edge = max(fwidth(altitude), 1e-5);
  let farCoverage = smoothstep(-edge, edge, far - altitude);
  let nearCoverage = smoothstep(-edge, edge, near - altitude);
  return vec2f(max(farCoverage, nearCoverage), nearCoverage);
}

@fragment
fn fsSky(in: VertexOutput) -> @location(0) vec4f {
  let direction = normalize(in.ray);
  let altitude = asin(clamp(dot(direction, uni.zenith.xyz), -1.0, 1.0));
  let angleToSun = acos(clamp(dot(direction, uni.towardSun.xyz), -1.0, 1.0));
  let clear = 1.0 - uni.params.x;
  let sky = (skyColor(altitude, angleToSun) + diamondGlint(direction)) * clear;
  let land = ground(direction, altitude);
  // Seen toward the Sun the land is backlit: hazy distant hills and dark nearer ones by day, a
  // black silhouette against the glow in totality.
  let landColor = (mix(DISTANT_HILLS, NEAR_LAND, land.y) * uni.zenith.w + TOTALITY_SKY * 0.15) * clear;
  let coverage = land.x;
  return vec4f(sky * (1.0 - coverage) + landColor * coverage, coverage);
}

@fragment
fn fsGlasses(in: VertexOutput) -> @location(0) vec4f {
  let direction = normalize(in.ray);
  let angleToSun = acos(clamp(dot(direction, uni.towardSun.xyz), -1.0, 1.0));
  let edge = max(fwidth(angleToSun), 1e-6);
  let onSun = smoothstep(uni.towardSun.w + edge, uni.towardSun.w - edge, angleToSun);
  let filtered = GLASSES_TINT * uni.params.y * onSun;
  return vec4f(mix(vec3f(1.0), filtered, uni.params.x), 1.0);
}
`
