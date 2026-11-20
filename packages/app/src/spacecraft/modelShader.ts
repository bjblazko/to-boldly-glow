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
export const MODEL_UNIFORM_FLOAT_COUNT = 16 + 16 + 4 + 4 + 4 + 4 + MAX_ASSEMBLIES * 4 * 2 + MAX_LAMPS * 4 * 2 + 16 + 4

// The kinds as the shader counts them (part.x).
export const ASSEMBLY_KIND_CODE = { solid: 0, shell: 1, inside: 2 } as const

export const modelShaderCode = /* wgsl */ `
struct Uniforms {
  viewProjection: mat4x4f,
  world: mat4x4f,
  // Toward the Sun, world space; w: sunlight strength.
  toLight: vec4f,
  cameraPosition: vec4f,
  // x: fill light, y: highlight's shininess, z: how far the exploded view has opened (0 to 1).
  look: vec4f,
  // x: the assembly picked out (-1: none), y: how strongly (0 to 1); z: the cut open (1) or not
  // (0), w: up to which height (model frame, metres).
  highlight: vec4f,
  offsets: array<vec4f, ${MAX_ASSEMBLIES}>,
  // x: the assembly's kind (0 solid, 1 shell, 2 inside), y: how visible it is (0 to 1).
  parts: array<vec4f, ${MAX_ASSEMBLIES}>,
  // Per lamp: xyz its place (world), w how far it reaches (0: no lamp); then rgb its colour times
  // its strength.
  lampPlaces: array<vec4f, ${MAX_LAMPS}>,
  lampColors: array<vec4f, ${MAX_LAMPS}>,
  // The first lamp's shadow map: world to its clip space; x: whether it casts shadows (0 or 1),
  // y: one texel of the map (in texture coordinates).
  shadowViewProjection: mat4x4f,
  shadow: vec4f,
}

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
  let moved = vert.position + uni.offsets[assembly].xyz * uni.look.z;
  let world = uni.world * vec4f(moved, 1.0);
  var out: VertexOutput;
  out.clip = uni.viewProjection * world;
  out.worldPosition = world.xyz;
  out.normal = (uni.world * vec4f(vert.normal, 0.0)).xyz;
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
fn lampLight(worldPosition: vec3f, normal: vec3f, toCamera: vec3f) -> vec3f {
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
    let shine = pow(max(dot(normal, normalize(direction + toCamera)), 0.0), 32.0) * 0.15 * step(0.0, facing);
    let shadowed = select(1.0, lampShadow(worldPosition), i == 0u);
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
  let specular = pow(max(dot(normal, halfway), 0.0), uni.look.y) * 0.25 * step(0.0, dot(normal, toLight));
  // A shell's inner face, seen through the cut, in shade.
  if (!frontFacing && uni.parts[in.assembly].x == 1.0) { albedo *= 0.35; }
  var color = albedo * (diffuse * uni.toLight.w + uni.look.x + lampLight(in.worldPosition, normal, toCamera)) + vec3f(specular * uni.toLight.w);
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
