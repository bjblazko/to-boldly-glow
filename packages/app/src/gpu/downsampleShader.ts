import { FULLSCREEN_TRIANGLE_VERTEX_WGSL } from './fullscreenTriangle'

// Dual-Kawase-style downsample: a 5-tap filter (center weighted double the 4 diagonal taps)
// that's cheap and avoids the aliasing a single bilinear tap would introduce when halving
// resolution repeatedly down the mip chain.
export const downsampleShaderCode = /* wgsl */ `
${FULLSCREEN_TRIANGLE_VERTEX_WGSL}

@group(0) @binding(0) var inputSampler: sampler;
@group(0) @binding(1) var inputTexture: texture_2d<f32>;

@fragment
fn fs(in: VertexOutput) -> @location(0) vec4f {
  let texelSize = 1.0 / vec2f(textureDimensions(inputTexture));
  let center = textureSampleLevel(inputTexture, inputSampler, in.uv, 0.0).rgb * 4.0;
  let tl = textureSampleLevel(inputTexture, inputSampler, in.uv - texelSize, 0.0).rgb;
  let tr = textureSampleLevel(inputTexture, inputSampler, in.uv + vec2f(texelSize.x, -texelSize.y), 0.0).rgb;
  let bl = textureSampleLevel(inputTexture, inputSampler, in.uv + vec2f(-texelSize.x, texelSize.y), 0.0).rgb;
  let br = textureSampleLevel(inputTexture, inputSampler, in.uv + texelSize, 0.0).rgb;
  let result = (center + tl + tr + bl + br) / 8.0;
  return vec4f(result, 1.0);
}
`
