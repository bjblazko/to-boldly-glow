// Uniform layout (must match the packing in skyBackdrop.ts):
//   [0..16)  inverseRotationViewProjection : mat4x4f (clip space back to a view ray, translation-free)
//   [16..28) sceneToGalactic              : mat3x3f (three vec4-padded columns)
//   [28..32) params                       : vec4f (x = brightness)
export const SKY_UNIFORM_FLOAT_COUNT = 32

// The sky behind the stars: one fullscreen triangle per frame that looks up, for every pixel's
// view direction, the painted galactic panorama (see packages/data-pipeline/src/paintMilkyWay.ts) -
// a matrix product, two inverse trig functions and one texture sample, about as cheap as a
// backdrop gets. The panorama is equirectangular in galactic coordinates, so the Milky Way runs
// along its middle; its left and right edges meet at the faint galactic anticenter. Mip selection
// across that seam uses whichever of two longitude parametrizations is continuous at the pixel
// (Tarini's trick), so the wrap leaves no line of blurred pixels. The panorama stores the square
// root of each sRGB value (finer steps near black); squaring the GPU's sRGB-decoded sample gives
// linear light.
export const skyShaderCode = /* wgsl */ `
struct Uniforms {
  inverseRotationViewProjection: mat4x4f,
  sceneToGalactic: mat3x3f,
  params: vec4f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) ray: vec3f,
};

const PI: f32 = 3.14159265;

@group(0) @binding(0) var<uniform> uni: Uniforms;
@group(0) @binding(1) var panorama: texture_2d<f32>;
@group(0) @binding(2) var panoramaSampler: sampler;

@vertex
fn vs(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var positions = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  let clip = vec4f(positions[vertexIndex], 0.5, 1.0);
  let point = uni.inverseRotationViewProjection * clip;
  var out: VertexOutput;
  out.position = vec4f(positions[vertexIndex], 0.0, 1.0);
  // Points on one plane in front of the camera: linear across the screen, so interpolating them
  // gives every pixel its exact view ray.
  out.ray = point.xyz / point.w;
  return out;
}

@fragment
fn fs(in: VertexOutput) -> @location(0) vec4f {
  let galactic = uni.sceneToGalactic * normalize(in.ray);
  let longitude = atan2(galactic.y, galactic.x) / (2.0 * PI);
  let u = longitude + 0.5;
  let v = 0.5 - asin(clamp(galactic.z, -1.0, 1.0)) / PI;
  // The same longitude, wrapping on the opposite side of the sky.
  let uShifted = fract(longitude + 1.0);
  let useShifted = fwidth(u) > fwidth(uShifted) + 1e-6;
  let dudx = select(dpdx(u), dpdx(uShifted), useShifted);
  let dudy = select(dpdy(u), dpdy(uShifted), useShifted);
  let encoded = textureSampleGrad(panorama, panoramaSampler, vec2f(u, v), vec2f(dudx, dpdx(v)), vec2f(dudy, dpdy(v))).rgb;
  return vec4f(encoded * encoded * uni.params.x, 1.0);
}
`
