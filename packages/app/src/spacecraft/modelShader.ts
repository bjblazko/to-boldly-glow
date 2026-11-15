// A textured model lit by the Sun: Lambert with a soft highlight, a faint fill so the shadowed side
// keeps its shape, and both faces of every triangle drawn (the model's thin sheets - the dish, the
// booms' struts - are single-sided). Each vertex belongs to an assembly that can move out (the
// exploded view) and be picked out with a glow while the rest dims.

export const MAX_ASSEMBLIES = 8
// viewProjection, world, toLight, cameraPosition, look, highlight, then one offset per assembly.
export const MODEL_UNIFORM_FLOAT_COUNT = 16 + 16 + 4 + 4 + 4 + 4 + MAX_ASSEMBLIES * 4

export const modelShaderCode = /* wgsl */ `
struct Uniforms {
  viewProjection: mat4x4f,
  world: mat4x4f,
  // Toward the Sun, world space; w: sunlight strength.
  toLight: vec4f,
  cameraPosition: vec4f,
  // x: fill light, y: highlight's shininess, z: how far the exploded view has opened (0 to 1).
  look: vec4f,
  // x: the assembly picked out (-1: none), y: how strongly (0 to 1).
  highlight: vec4f,
  offsets: array<vec4f, ${MAX_ASSEMBLIES}>,
}

@group(0) @binding(0) var<uniform> uni: Uniforms;
@group(0) @binding(1) var modelSampler: sampler;
@group(0) @binding(2) var modelTexture: texture_2d<f32>;

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
  return out;
}

const GLOW = vec3f(0.35, 0.75, 1.0);

@fragment
fn fs(in: VertexOutput, @builtin(front_facing) frontFacing: bool) -> @location(0) vec4f {
  let albedo = textureSample(modelTexture, modelSampler, in.uv).rgb;
  let toCamera = normalize(uni.cameraPosition.xyz - in.worldPosition);
  var normal = normalize(in.normal);
  if (!frontFacing) { normal = -normal; }
  let toLight = normalize(uni.toLight.xyz);
  let diffuse = max(dot(normal, toLight), 0.0);
  let halfway = normalize(toLight + toCamera);
  let specular = pow(max(dot(normal, halfway), 0.0), uni.look.y) * 0.25 * step(0.0, dot(normal, toLight));
  var color = albedo * (diffuse * uni.toLight.w + uni.look.x) + vec3f(specular * uni.toLight.w);
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
