import { coronaStructure, PROMINENCE_COUNT, STREAMER_COUNT, wgslVec4Array } from './coronaStructure'

// Uniform layout (must match the packing in sunCorona.ts exactly):
//   [0..16)   viewProjection : mat4x4f
//   [16..32)  sunToWorld     : mat4x4f (the Sun's rotation: its own frame, +Z along its spin axis, to world)
//   [32..36)  center         : vec4f (xyz = the Sun's center, w = its radius)
//   [36..40)  axisU          : vec4f (xyz = the quad's first half-axis, world units; w = the camera's
//                              distance from the Sun's center, solar radii)
//   [40..44)  axisV          : vec4f (xyz = the second half-axis)
//   [44..48)  lineOfSight    : vec4f (xyz = unit direction from the camera to the Sun's center)
//   [48..52)  exposure       : vec4f (x = the corona's brightness, y = the chromosphere's and
//                              prominences', z = how far out the corona is drawn, solar radii)
//   [52..56)  pole           : vec4f (xyz = the Sun's spin axis as seen across the line of sight)
//   [56..96)  streamers      : one vec4f per streamer, [96..128) prominences: one per prominence -
//                              where it shows up across the line of sight (xyz, unit) and how much of
//                              it lies across the line of sight (w: 1 at the limb, 0 pointing at the
//                              camera); see seenAcross in coronaView.ts
export const CORONA_UNIFORM_FLOAT_COUNT = 56 + 4 * STREAMER_COUNT + 4 * PROMINENCE_COUNT

// The streamers and prominences the shader draws; sunCorona.ts tells it where they are seen from.
export const CORONA_STRUCTURE = coronaStructure()
const { streamers, prominences } = CORONA_STRUCTURE

// The Sun's outer atmosphere: a pearly glow that falls off steeply away from the Sun, combed into
// helmet streamers - broad, bright bases that narrow into long thin stalks - fine radial rays, and
// fainter polar regions. Drawn on a quad through the Sun's center, facing the camera: whatever lies
// in front of the Sun covers it, the Sun's own disc included. Along each line of sight the shader
// works with the impact parameter - how close the line passes to the Sun's center - so the corona
// keeps its true size and shape however close the camera comes. Streamers, rays and prominences are
// fixed to the Sun and turn with it.
//
// Next to the bright disc the corona is all but drowned out (photographs of it need an eclipse);
// when a planet or moon covers the Sun, the exposure opens up and it shows in full - and with it the
// thin red chromosphere and the prominences standing out at the limb.
export const coronaShaderCode = /* wgsl */ `
struct Uniforms {
  viewProjection: mat4x4f,
  sunToWorld: mat4x4f,
  center: vec4f,
  axisU: vec4f,
  axisV: vec4f,
  lineOfSight: vec4f,
  exposure: vec4f,
  pole: vec4f,
  streamers: array<vec4f, ${STREAMER_COUNT}>,
  prominences: array<vec4f, ${PROMINENCE_COUNT}>,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  // Offset from the Sun's center within the quad's plane, world directions, in solar radii.
  @location(0) skyOffset: vec3f,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;

// Per streamer: strength, width, length and bend.
${wgslVec4Array('STREAMER_SHAPES', streamers.map((streamer) => [streamer.strength, streamer.width, streamer.length, streamer.bend]))}
// Per prominence: height and width (solar radii).
${wgslVec4Array('PROMINENCE_SHAPES', prominences.map((prominence) => [prominence.height, prominence.width, 0, 0]))}

// The scattered photospheric light of the corona is white, a little warmer than daylight.
const CORONA_COLOR = vec3f(1.0, 0.95, 0.88);
// The chromosphere and prominences glow in hydrogen's red H-alpha line, pinkish with H-beta's blue.
const HYDROGEN_COLOR = vec3f(1.0, 0.2, 0.36);
// The chromosphere is only about 2,000 km deep (0.003 solar radii) - drawn a bit thicker to show.
const CHROMOSPHERE_DEPTH: f32 = 0.006;

@vertex
fn vs(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var corners = array<vec2f, 4>(vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0), vec2f(1.0, 1.0));
  let corner = corners[vertexIndex];
  let offset = uni.axisU.xyz * corner.x + uni.axisV.xyz * corner.y;
  var out: VertexOutput;
  out.position = uni.viewProjection * vec4f(uni.center.xyz + offset, 1.0);
  out.skyOffset = offset / uni.center.w;
  return out;
}

// The K corona's brightness (Baumbach's fit, relative to its value at the limb's foot) at b solar
// radii from the Sun's center - with its dynamic range compressed, the way eclipse photographs are
// processed to show what the eye sees: from the limb to four radii out the true corona fades by
// more than a thousand times, far beyond what one picture can hold.
const DYNAMIC_RANGE_COMPRESSION: f32 = 0.6;

fn kCorona(b: f32) -> f32 {
  let baumbach = 0.0532 * pow(b, -2.5) + 1.425 * pow(b, -7.0) + 2.565 * pow(b, -17.0);
  return pow(baumbach, DYNAMIC_RANGE_COMPRESSION);
}

fn hash31(p: vec3f) -> f32 {
  var q = fract(p * 0.1031);
  q += dot(q, q.zyx + 31.32);
  return fract((q.x + q.y) * q.z);
}

fn valueNoise(p: vec3f) -> f32 {
  let cell = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  let x00 = mix(hash31(cell), hash31(cell + vec3f(1.0, 0.0, 0.0)), u.x);
  let x10 = mix(hash31(cell + vec3f(0.0, 1.0, 0.0)), hash31(cell + vec3f(1.0, 1.0, 0.0)), u.x);
  let x01 = mix(hash31(cell + vec3f(0.0, 0.0, 1.0)), hash31(cell + vec3f(1.0, 0.0, 1.0)), u.x);
  let x11 = mix(hash31(cell + vec3f(0.0, 1.0, 1.0)), hash31(cell + vec3f(1.0, 1.0, 1.0)), u.x);
  return mix(mix(x00, x10, u.y), mix(x01, x11, u.y), u.z);
}

// The sky direction's angle (signed, radians) from where a feature of the Sun shows up in the sky.
fn angleFrom(seen: vec4f, skyDirection: vec3f) -> f32 {
  return atan2(dot(cross(seen.xyz, skyDirection), uni.lineOfSight.xyz), dot(seen.xyz, skyDirection));
}

// Helmet streamers: a broad, bright base over the Sun's surface narrowing into a long thin stalk.
// Seen end-on, a streamer is foreshortened - shorter and spread around the Sun.
fn streamerLight(b: f32, skyDirection: vec3f) -> f32 {
  var sum = 0.0;
  for (var i = 0; i < ${STREAMER_COUNT}; i++) {
    let seen = uni.streamers[i];
    let shape = STREAMER_SHAPES[i];
    let foreshortening = max(seen.w, 0.2);
    let r = b / foreshortening;
    // The stalk keeps narrowing toward its far end.
    let halfWidth = shape.y * mix(0.45, 0.11, smoothstep(1.2, 3.0, r)) * (1.0 - 0.5 * smoothstep(3.0, 7.0, r)) / max(foreshortening, 0.4);
    let across = (angleFrom(seen, skyDirection) - shape.w * smoothstep(1.2, 4.0, r)) / halfWidth;
    let stalk = 2.0 * smoothstep(1.5, 2.6, r) * exp(-max(r - 2.6, 0.0) / shape.z);
    let along = 0.8 * exp(-(r - 1.35) * (r - 1.35) / 0.15) + stalk;
    sum += shape.x * exp(-across * across) * along;
  }
  return sum;
}

// Prominences: clouds of cooler gas held up by magnetic fields, showing as red flames at the limb.
fn prominenceLight(b: f32, skyDirection: vec3f) -> f32 {
  let height = max(b - 1.0, 0.0);
  var sum = 0.0;
  for (var i = 0; i < ${PROMINENCE_COUNT}; i++) {
    let shape = PROMINENCE_SHAPES[i];
    let seen = uni.prominences[i];
    let angle = angleFrom(seen, skyDirection);
    let atLimb = smoothstep(0.8, 0.97, seen.w);
    let along = angle / shape.y;
    let flame = valueNoise(vec3f(angle * 120.0, height * 70.0, f32(i) * 7.3));
    sum += atLimb * exp(-along * along) * exp(-height / shape.x) * (0.3 + flame);
  }
  return sum;
}

@fragment
fn fs(in: VertexOutput) -> @location(0) vec4f {
  let rho = length(in.skyOffset);
  let d = uni.axisU.w;
  // How close this line of sight passes to the Sun's center (solar radii).
  let b = rho * d / sqrt(d * d + rho * rho);
  let extent = uni.exposure.z;
  if (b < 0.99 || b > extent) {
    discard;
  }
  let skyDirection = in.skyOffset / max(rho, 1e-6);
  let polar = pow(abs(dot(skyDirection, uni.pole.xyz)), 3.0);
  // Fine rays and polar plumes: brightness varying with direction only, so it runs radially outward.
  let ownDirection = (transpose(uni.sunToWorld) * vec4f(skyDirection, 0.0)).xyz;
  let fine = 0.6 * valueNoise(ownDirection * 24.0) + 0.4 * valueNoise(ownDirection * 70.0);
  let rays = mix(1.0, 0.55 + 0.9 * fine, 0.35 + 0.4 * polar);
  let background = (1.0 - 0.55 * smoothstep(1.3, 3.0, b)) * (1.0 - 0.5 * polar);
  let fade = 1.0 - smoothstep(0.6 * extent, extent, b);
  let raw = kCorona(b) * (background + streamerLight(b, skyDirection)) * rays * fade * uni.exposure.x;
  // The brightest inner corona rolls off softly instead of flaring the bloom over the eclipsing body.
  let corona = raw / (1.0 + 0.5 * raw);
  var hydrogen = 0.0;
  if (uni.exposure.y > 0.0) {
    let chromosphere = exp(-(b - 1.0) / CHROMOSPHERE_DEPTH) * 0.8;
    hydrogen = (chromosphere + 1.6 * prominenceLight(b, skyDirection)) * uni.exposure.y;
  }
  return vec4f(CORONA_COLOR * corona + HYDROGEN_COLOR * hydrogen, 0.0);
}
`
