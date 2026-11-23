import { HINGE_WGSL } from './modelHinge'

// A textured model lit by the Sun: Lambert with a soft highlight, a faint fill so the shadowed side
// keeps its shape, and both faces of every triangle drawn (the model's thin sheets - the dish, the
// booms' struts - are single-sided). Each vertex belongs to an assembly that can move out (the
// exploded view), be picked out with a glow while the rest dims, fade away, and - for a model with
// an inside (the Saturn V) - be cut open: a shell loses the quarter between +X and +Z below the
// cut's height, its inner face darker, and what is inside shows only there.

export const MAX_ASSEMBLIES = 16
// viewProjection, world, toLight, cameraPosition, look, highlight, then per assembly its offset
// and its part (kind, visibility).
// Lamps: a cabin's floodlights (none for a spacecraft in sunlight).
export const MAX_LAMPS = 3
// viewProjection, world, toLight, cameraPosition, look, highlight, per assembly its offset and its
// part, per lamp its place and range and its colour and strength, then the first lamp's shadow map
// projection and its settings.
// and each assembly's fold about its hinge (three rows).
// Last, for a craft in space: its settings and the light thrown back by a body near by.
export const MODEL_UNIFORM_FLOAT_COUNT = 16 + 16 + 4 + 4 + 4 + 4 + MAX_ASSEMBLIES * 4 * 2 + MAX_LAMPS * 4 * 2 + 16 + 4 + MAX_ASSEMBLIES * 12 + 12

// The kinds as the shader counts them (part.x).
export const ASSEMBLY_KIND_CODE = { solid: 0, shell: 1, inside: 2 } as const

export const modelShaderCode = /* wgsl */ `
struct Uniforms {
  viewProjection: mat4x4f,
  world: mat4x4f,
  // Toward the Sun, world space; w: sunlight strength.
  toLight: vec4f,
  cameraPosition: vec4f,
  // x: fill light, y: how worn the surfaces look (0 to 1), z: how far the exploded view has opened
  // (0 to 1).
  look: vec4f,
  // x: the assembly picked out (-1: none), y: how strongly (0 to 1); z: the cut open (1) or not
  // (0), w: up to which height (model frame, metres).
  highlight: vec4f,
  offsets: array<vec4f, ${MAX_ASSEMBLIES}>,
  // x: the assembly's kind (0 solid, 1 shell, 2 inside), y: how visible it is (0 to 1), z: how
  // tight its highlight is (shininess), w: how strong (its material: metal shines, fabric hardly).
  parts: array<vec4f, ${MAX_ASSEMBLIES}>,
  // Per lamp: xyz its place (world), w how far it reaches (0: no lamp); then rgb its colour times
  // its strength.
  lampPlaces: array<vec4f, ${MAX_LAMPS}>,
  lampColors: array<vec4f, ${MAX_LAMPS}>,
  // The first lamp's shadow map: world to its clip space; x: whether it casts shadows (0 or 1),
  // y: one texel of the map (in texture coordinates).
  shadowViewProjection: mat4x4f,
  shadow: vec4f,
  // Each assembly's fold about its hinge (see modelHinge.ts).
  hinges: array<vec4f, ${MAX_ASSEMBLIES * 3}>,
  // In space (x: 1): no room round it - a flat, faint fill, mirrors that see black space and the
  // body near by (y: the cosine of its apparent radius); z: 1 when the shadow map is the Sun's.
  space: vec4f,
  // Toward the body near by (world), w: how much of its light it throws back; and its colour.
  bounceDirection: vec4f,
  bounceColor: vec4f,
}
${HINGE_WGSL}

@group(0) @binding(0) var<uniform> uni: Uniforms;
@group(0) @binding(1) var modelSampler: sampler;
@group(0) @binding(2) var modelTexture: texture_2d<f32>;
@group(0) @binding(3) var shadowSampler: sampler_comparison;
@group(0) @binding(4) var shadowMap: texture_depth_2d;

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
  @location(3) assembly: f32,
}

struct VertexOutput {
  @builtin(position) clip: vec4f,
  @location(0) worldPosition: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
  @location(3) @interpolate(flat) assembly: i32,
  // The point in the model's own frame, after the exploded view moved it.
  @location(4) local: vec3f,
}

@vertex
fn vs(vert: VertexInput) -> VertexOutput {
  let assembly = i32(round(vert.assembly));
  let moved = hinged(assembly, vert.position, 1.0) + uni.offsets[assembly].xyz * uni.look.z;
  let world = uni.world * vec4f(moved, 1.0);
  var out: VertexOutput;
  out.clip = uni.viewProjection * world;
  out.worldPosition = world.xyz;
  out.normal = (uni.world * vec4f(hinged(assembly, vert.normal, 0.0), 0.0)).xyz;
  out.uv = vert.uv;
  out.assembly = assembly;
  out.local = moved;
  return out;
}

// A fixed pattern of thresholds over the screen: fading a part drops more of its pixels.
fn dither(position: vec2f) -> f32 {
  let cell = vec2u(position) % vec2u(4u);
  var matrix = array<f32, 16>(0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  return (matrix[cell.y * 4u + cell.x] + 0.5) / 16.0;
}

// Whether a fragment is left out: faded away, cut away, or inside while the model is closed.
fn hidden(in: VertexOutput, position: vec2f) -> bool {
  let part = uni.parts[in.assembly];
  if (part.y < dither(position)) { return true; }
  let open = uni.highlight.z > 0.0 && in.local.y < uni.highlight.w;
  let inCutQuarter = open && in.local.x > 0.0 && in.local.z > 0.0;
  if (part.x == 1.0) { return inCutQuarter; }
  if (part.x == 2.0) { return !open; }
  return false;
}

const GLOW = vec3f(0.35, 0.75, 1.0);

fn hash3(p: vec3f) -> f32 {
  return fract(sin(dot(p, vec3f(127.1, 311.7, 74.7))) * 43758.5453);
}

// Smooth value noise in 3D (0 to 1).
fn noise3(p: vec3f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  let bottom = mix(mix(hash3(i), hash3(i + vec3f(1.0, 0.0, 0.0)), u.x), mix(hash3(i + vec3f(0.0, 1.0, 0.0)), hash3(i + vec3f(1.0, 1.0, 0.0)), u.x), u.y);
  let top = mix(mix(hash3(i + vec3f(0.0, 0.0, 1.0)), hash3(i + vec3f(1.0, 0.0, 1.0)), u.x), mix(hash3(i + vec3f(0.0, 1.0, 1.0)), hash3(i + vec3f(1.0, 1.0, 1.0)), u.x), u.y);
  return mix(bottom, top, u.z);
}

// How much wear darkens a point (model frame, metres): uneven paint at two sizes, and streaks that
// run down (noise stretched along the height).
fn wearAt(local: vec3f) -> f32 {
  let mottle = noise3(local * 1.4) * 0.6 + noise3(local * 6.0) * 0.4;
  let streaks = noise3(vec3f(local.x * 22.0, local.y * 0.7, local.z * 22.0));
  return mottle * 0.14 + smoothstep(0.6, 0.92, streaks) * 0.16;
}

// What a mirror-like surface sees in a direction: a dark room, lit by a few soft light panels - a
// broad one overhead, two tall ones at the sides - and a faint band at the horizon. Fixed in the
// world, so the lights slide over the surface as the model turns: contrast, as polished foil shows.
fn surroundings(direction: vec3f) -> vec3f {
  let dark = mix(vec3f(0.015, 0.03, 0.05), vec3f(0.05, 0.07, 0.1), smoothstep(-0.4, 0.4, direction.y));
  let overhead = smoothstep(0.75, 0.92, direction.y) * 0.9;
  let around = atan2(direction.z, direction.x);
  let panels = (smoothstep(0.22, 0.08, abs(around - 0.9)) + smoothstep(0.16, 0.05, abs(around + 2.3)) * 0.7) * smoothstep(-0.25, 0.05, direction.y) * smoothstep(0.7, 0.45, direction.y);
  let horizon = exp(-abs(direction.y) * 18.0) * 0.12;
  return dark + vec3f(overhead + panels * 0.85 + horizon);
}

// The fill as light from all round: brighter from above (the sky, the room's ceiling) than from
// below (the floor).
fn ambient(normal: vec3f) -> f32 {
  if (uni.space.x > 0.5) { return uni.look.x; }
  return uni.look.x * mix(0.45, 1.25, normal.y * 0.5 + 0.5);
}

// In space: the light a sunlit Earth or Moon throws back onto the side facing it, wrapping softly.
fn bounceLight(normal: vec3f) -> vec3f {
  if (uni.bounceDirection.w <= 0.0) { return vec3f(0.0); }
  let facing = dot(normal, uni.bounceDirection.xyz) * 0.5 + 0.5;
  return uni.bounceColor.rgb * uni.bounceDirection.w * facing * facing;
}

// What a mirror sees in space: black, and the body near by as a disc of its light.
fn spaceSurroundings(direction: vec3f) -> vec3f {
  let onBody = smoothstep(uni.space.y - 0.01, uni.space.y + 0.01, dot(direction, uni.bounceDirection.xyz));
  return uni.bounceColor.rgb * uni.bounceDirection.w * 2.5 * onBody;
}

// How much of the first lamp's light reaches this point (0 to 1): the shadow map compared at nine
// points around it, for a soft edge. Outside the lamp's cone counts as lit.
fn lampShadow(worldPosition: vec3f) -> f32 {
  if (uni.shadow.x == 0.0) { return 1.0; }
  let clip = uni.shadowViewProjection * vec4f(worldPosition, 1.0);
  let ndc = clip.xyz / clip.w;
  let uv = vec2f(ndc.x * 0.5 + 0.5, 0.5 - ndc.y * 0.5);
  if (clip.w <= 0.0 || any(uv < vec2f(0.0)) || any(uv > vec2f(1.0)) || ndc.z > 1.0) { return 1.0; }
  var lit = 0.0;
  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      lit += textureSampleCompareLevel(shadowMap, shadowSampler, uv + vec2f(f32(dx), f32(dy)) * uni.shadow.y, ndc.z - 0.0005);
    }
  }
  return lit / 9.0;
}

// The lamps' light on a surface: each falls off with distance (softly, reaching zero at its range)
// and lights the side facing it, wrapping softly round, with a little shine; the first lamp casts
// shadows.
fn lampLight(worldPosition: vec3f, normal: vec3f, toCamera: vec3f, material: vec2f) -> vec3f {
  var light = vec3f(0.0);
  for (var i = 0u; i < ${MAX_LAMPS}u; i++) {
    let place = uni.lampPlaces[i];
    if (place.w <= 0.0) { continue; }
    let toLamp = place.xyz - worldPosition;
    let distance = length(toLamp);
    let direction = toLamp / max(distance, 1e-4);
    let falloff = 1.0 / (1.0 + 4.0 * distance * distance) * (1.0 - smoothstep(0.6 * place.w, place.w, distance));
    // Half Lambert: the light wraps softly round to the far side instead of stopping at a hard edge,
    // so it models a scanned surface without tracing every triangle of it.
    let facing = dot(normal, direction);
    let diffuse = (facing * 0.5 + 0.5) * (facing * 0.5 + 0.5);
    let shine = pow(max(dot(normal, normalize(direction + toCamera)), 0.0), material.x) * material.y * step(0.0, facing);
    let shadowed = select(1.0, lampShadow(worldPosition), i == 0u && uni.space.z < 0.5);
    light += uni.lampColors[i].rgb * falloff * (diffuse + shine) * shadowed;
  }
  return light;
}

@fragment
fn fs(in: VertexOutput, @builtin(front_facing) frontFacing: bool) -> @location(0) vec4f {
  var albedo = textureSample(modelTexture, modelSampler, in.uv).rgb;
  // In the fragment stage the clip position holds the pixel's place on the screen.
  if (hidden(in, in.clip.xy)) { discard; }
  let toCamera = normalize(uni.cameraPosition.xyz - in.worldPosition);
  var normal = normalize(in.normal);
  if (!frontFacing) { normal = -normal; }
  let toLight = normalize(uni.toLight.xyz);
  let diffuse = max(dot(normal, toLight), 0.0);
  let halfway = normalize(toLight + toCamera);
  let mirror = uni.parts[in.assembly].z < 0.0;
  let material = vec2f(abs(uni.parts[in.assembly].z), uni.parts[in.assembly].w);
  let specular = pow(max(dot(normal, halfway), 0.0), material.x) * material.y * step(0.0, dot(normal, toLight));
  // A shell's inner face, seen through the cut, in shade.
  if (!frontFacing && uni.parts[in.assembly].x == 1.0) { albedo *= 0.35; }
  albedo *= 1.0 - uni.look.y * wearAt(in.local);
  // In space the Sun's own shadows (the map is then the Sun's).
  let sunlight = uni.toLight.w * select(1.0, lampShadow(in.worldPosition), uni.space.z > 0.5);
  var color = albedo * (diffuse * sunlight + ambient(normal) + bounceLight(normal) + lampLight(in.worldPosition, normal, toCamera, material)) + vec3f(specular * sunlight);
  if (mirror) {
    // Mostly what it reflects, tinted by its own colour, a little of its lit colour beneath.
    let around = select(surroundings(reflect(-toCamera, normal)), spaceSurroundings(reflect(-toCamera, normal)), uni.space.x > 0.5);
    let seen = around * albedo * material.y;
    color = color * (1.0 - material.y * 0.9) + seen + vec3f(specular * sunlight);
  }
  let picked = uni.highlight.x >= 0.0 && in.assembly == i32(uni.highlight.x);
  let strength = uni.highlight.y;
  if (picked) {
    let rim = pow(1.0 - abs(dot(normal, toCamera)), 2.0);
    color += GLOW * (0.12 + 0.5 * rim) * strength;
  } else if (uni.highlight.x >= 0.0) {
    color *= 1.0 - 0.55 * strength;
  }
  return vec4f(color, 1.0);
}
`
