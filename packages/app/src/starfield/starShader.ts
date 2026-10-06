// Uniform layout: [0..16) rotationOnlyViewProjection : mat4x4f, [16..18) pixelSize : vec2f
// (padded to 20 floats so the buffer size stays a multiple of 16 bytes for uniform alignment).
//
// Each star is one instance of a 4-vertex triangle-strip quad, expanded entirely on the GPU from
// @builtin(vertex_index) — no per-star vertex geometry is needed. Stars are placed at a fixed
// large distance along their real direction (never at true light-year distances), so this
// sidesteps the floating-origin precision technique entirely: only direction matters here.
// rotationOnlyViewProjection is `projection * view` with the view matrix's translation stripped,
// making the quad rotate with the camera but never translate with it, like an infinitely distant
// skybox. The quad's screen-space offset is scaled by `center.w` so it stays a constant pixel size
// regardless of depth (clip-space xy is divided by w before rasterization, so pre-multiplying by w
// here cancels that division). No depth test is used — stars are drawn first in the pass, so
// opaque bodies naturally paint over them (painter's algorithm), avoiding depth-precision issues
// at this distance entirely.
export const starShaderCode = /* wgsl */ `
struct Uniforms {
  rotationOnlyViewProjection: mat4x4f,
  pixelSize: vec2f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) brightness: f32,
};

const STAR_DISTANCE: f32 = 900.0;

@group(0) @binding(0) var<uniform> uni: Uniforms;

@vertex
fn vs(
  @builtin(vertex_index) vertexIndex: u32,
  @location(0) starDirection: vec3f,
  @location(1) brightness: f32,
) -> VertexOutput {
  var corners = array<vec2f, 4>(vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0), vec2f(1.0, 1.0));
  let corner = corners[vertexIndex];

  let center = uni.rotationOnlyViewProjection * vec4f(normalize(starDirection) * STAR_DISTANCE, 1.0);
  let offset = corner * uni.pixelSize * brightness;

  var out: VertexOutput;
  out.position = vec4f(center.xy + offset * center.w, center.z, center.w);
  out.uv = corner;
  out.brightness = brightness;
  return out;
}

@fragment
fn fs(in: VertexOutput) -> @location(0) vec4f {
  let falloff = smoothstep(1.0, 0.0, length(in.uv));
  let intensity = in.brightness * falloff;
  return vec4f(vec3f(1.0, 1.0, 0.95) * intensity, intensity);
}
`
