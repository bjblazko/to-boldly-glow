// Uniform layout: [0..16) rotationOnlyViewProjection : mat4x4f, [16..18) cssPixelSize : vec2f
// (clip-space units per CSS pixel), [18] spike strength scale (0 turns the spikes off).
// Padded to 20 floats so the buffer size stays a multiple of 16 bytes for uniform alignment.
export const STAR_UNIFORM_FLOAT_COUNT = 20

// Each star is one instance of a 4-vertex triangle-strip quad, expanded entirely on the GPU from
// @builtin(vertex_index) — no per-star vertex geometry is needed. Stars are placed at a fixed
// large distance along their real direction (never at true light-year distances), so this
// sidesteps the floating-origin precision technique entirely: only direction matters here.
// rotationOnlyViewProjection is `projection * view` with the view matrix's translation stripped,
// making the quad rotate with the camera but never translate with it, like an infinitely distant
// skybox. The quad's screen-space offset is scaled by `center.w` so it stays a constant pixel size
// regardless of depth (clip-space xy is divided by w before rasterization, so pre-multiplying by w
// here cancels that division). No depth test is used — stars are drawn right after the sky
// backdrop, so opaque bodies naturally paint over them (painter's algorithm), avoiding
// depth-precision issues at this distance entirely.
//
// A star is a point of light smeared by the camera's optics: a Gaussian core (sized in CSS pixels,
// so it looks the same on a high-density display), a faint wider halo, and - on the brightest
// few - four thin diffraction spikes, as a telescope's secondary-mirror vanes draw them. The core
// saturates at the brightness of a magnitude-1 star; brighter stars grow wider instead.
export const starShaderCode = /* wgsl */ `
struct Uniforms {
  rotationOnlyViewProjection: mat4x4f,
  cssPixelSize: vec2f,
  spikeScale: f32,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) offsetPx: vec2f,
  @location(1) @interpolate(flat) color: vec3f,
  // x = core radius (Gaussian sigma, px), y = core peak, z = spike strength, w = spike length (px).
  @location(2) @interpolate(flat) shape: vec4f,
};

const STAR_DISTANCE: f32 = 900.0;
const CORE_SIGMA_PX: f32 = 0.75;
const SPIKE_LENGTH_PX: f32 = 26.0;

@group(0) @binding(0) var<uniform> uni: Uniforms;

@vertex
fn vs(
  @builtin(vertex_index) vertexIndex: u32,
  @location(0) starDirection: vec3f,
  @location(1) intensity: f32,
  @location(2) color: vec3f,
  @location(3) spike: f32,
) -> VertexOutput {
  var corners = array<vec2f, 4>(vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0), vec2f(1.0, 1.0));
  let peak = min(intensity, 1.0);
  let sigma = CORE_SIGMA_PX * sqrt(max(intensity, 1.0));
  let spikeStrength = spike * uni.spikeScale;
  let spikeLength = SPIKE_LENGTH_PX * spikeStrength;
  let radiusPx = max(sigma * 3.5 + 0.5, spikeLength);
  let offsetPx = corners[vertexIndex] * radiusPx;

  let center = uni.rotationOnlyViewProjection * vec4f(normalize(starDirection) * STAR_DISTANCE, 1.0);
  var out: VertexOutput;
  out.position = vec4f(center.xy + offsetPx * uni.cssPixelSize * center.w, center.z, center.w);
  out.offsetPx = offsetPx;
  out.color = color;
  out.shape = vec4f(sigma, peak, spikeStrength, max(spikeLength, 1.0));
  return out;
}

@fragment
fn fs(in: VertexOutput) -> @location(0) vec4f {
  let sigma = in.shape.x;
  let distanceSquared = dot(in.offsetPx, in.offsetPx);
  let core = exp(-distanceSquared / (2.0 * sigma * sigma));
  let halo = 0.06 * exp(-sqrt(distanceSquared) / (sigma * 2.5));
  let along = abs(in.offsetPx) / in.shape.w;
  let across = in.offsetPx.yx * in.offsetPx.yx;
  let spikes = (1.0 - smoothstep(0.0, 1.0, along.x)) * exp(-across.x * 1.5) + (1.0 - smoothstep(0.0, 1.0, along.y)) * exp(-across.y * 1.5);
  let light = in.shape.y * (core + halo) + in.shape.z * spikes * 0.35;
  return vec4f(in.color * light, light);
}
`
