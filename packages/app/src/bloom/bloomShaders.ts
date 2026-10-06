import { FULLSCREEN_TRIANGLE_VERTEX_WGSL } from '../gpu/fullscreenTriangle'

// Bright-pass: extracts the portion of the HDR scene color above THRESHOLD (per channel, not
// luminance — simpler, and sufficient for a single dominant bloom source like the Sun). Rendered
// into the bloom mip chain's base level, which is already half the canvas resolution.
const BLOOM_THRESHOLD = 1.0

export const brightPassShaderCode = /* wgsl */ `
${FULLSCREEN_TRIANGLE_VERTEX_WGSL}

@group(0) @binding(0) var inputSampler: sampler;
@group(0) @binding(1) var inputTexture: texture_2d<f32>;

@fragment
fn fs(in: VertexOutput) -> @location(0) vec4f {
  let color = textureSampleLevel(inputTexture, inputSampler, in.uv, 0.0).rgb;
  let bright = max(color - vec3f(${BLOOM_THRESHOLD.toFixed(1)}), vec3f(0.0));
  return vec4f(bright, 1.0);
}
`

// Dual-Kawase-style upsample: a 9-tap tent filter (weights 4/2/2/2/2/1/1/1/1, sum 16) sampling the
// smaller/blurrier mip level. The render pass this draws into uses additive blending and loadOp
// 'load', so this adds a widened, blurred copy of the level below onto whatever the downsample
// chain already wrote at this level — progressively accumulating blur from coarse to fine mips.
export const bloomUpsampleShaderCode = /* wgsl */ `
${FULLSCREEN_TRIANGLE_VERTEX_WGSL}

@group(0) @binding(0) var inputSampler: sampler;
@group(0) @binding(1) var inputTexture: texture_2d<f32>;

@fragment
fn fs(in: VertexOutput) -> @location(0) vec4f {
  let texelSize = 1.0 / vec2f(textureDimensions(inputTexture));
  var sum = textureSampleLevel(inputTexture, inputSampler, in.uv, 0.0).rgb * 4.0;
  sum += textureSampleLevel(inputTexture, inputSampler, in.uv + vec2f(-texelSize.x, 0.0), 0.0).rgb * 2.0;
  sum += textureSampleLevel(inputTexture, inputSampler, in.uv + vec2f(texelSize.x, 0.0), 0.0).rgb * 2.0;
  sum += textureSampleLevel(inputTexture, inputSampler, in.uv + vec2f(0.0, -texelSize.y), 0.0).rgb * 2.0;
  sum += textureSampleLevel(inputTexture, inputSampler, in.uv + vec2f(0.0, texelSize.y), 0.0).rgb * 2.0;
  sum += textureSampleLevel(inputTexture, inputSampler, in.uv + vec2f(-texelSize.x, -texelSize.y), 0.0).rgb;
  sum += textureSampleLevel(inputTexture, inputSampler, in.uv + vec2f(texelSize.x, -texelSize.y), 0.0).rgb;
  sum += textureSampleLevel(inputTexture, inputSampler, in.uv + vec2f(-texelSize.x, texelSize.y), 0.0).rgb;
  sum += textureSampleLevel(inputTexture, inputSampler, in.uv + vec2f(texelSize.x, texelSize.y), 0.0).rgb;
  return vec4f(sum / 16.0, 1.0);
}
`

// Composite: adds the bloom mip chain's base level (already upsampled/accumulated back up to it)
// onto the full-resolution HDR scene color, then tonemaps (Reinhard) down to displayable [0,1]
// before writing to the swapchain. This is the only pass that touches the swapchain.
const BLOOM_INTENSITY = 0.6

export const bloomCompositeShaderCode = /* wgsl */ `
${FULLSCREEN_TRIANGLE_VERTEX_WGSL}

@group(0) @binding(0) var inputSampler: sampler;
@group(0) @binding(1) var hdrTexture: texture_2d<f32>;
@group(0) @binding(2) var bloomTexture: texture_2d<f32>;

@fragment
fn fs(in: VertexOutput) -> @location(0) vec4f {
  let hdrColor = textureSampleLevel(hdrTexture, inputSampler, in.uv, 0.0).rgb;
  let bloomColor = textureSampleLevel(bloomTexture, inputSampler, in.uv, 0.0).rgb;
  let combined = hdrColor + bloomColor * ${BLOOM_INTENSITY.toFixed(1)};
  let tonemapped = combined / (vec3f(1.0) + combined);
  // This pass writes directly to the swapchain's non-sRGB storage format (getPreferredCanvasFormat()
  // returns a plain unorm format, not a "-srgb" variant), so nothing downstream gamma-encodes for
  // us — unlike sRGB-decoded texture samples elsewhere in the renderer, which the GPU auto-linearizes
  // on read. Without this, everything (dim stars especially) displays far too dark, since a
  // display expects gamma-encoded values, not linear light. gamma 2.2 is a standard approximation
  // of the true sRGB transfer function, accurate enough for a real-time composite like this.
  let gammaEncoded = pow(max(tonemapped, vec3f(0.0)), vec3f(1.0 / 2.2));
  return vec4f(gammaEncoded, 1.0);
}
`
