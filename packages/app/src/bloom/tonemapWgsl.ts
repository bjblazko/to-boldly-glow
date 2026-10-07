// How the HDR scene's light is squeezed into what a display can show. Part of the bloom composite
// (see bloomShaders.ts): each takes scene-linear light and returns display-encoded color. Reinhard
// squeezes each color channel on its own, so over-bright light stays saturated, as if painted;
// AgX - the Display panel's "Filmic look" - burns it out toward white the way film does.
export type Tonemapper = 'reinhard' | 'agx'

export const TONEMAPPERS: readonly Tonemapper[] = ['reinhard', 'agx']

const GAMMA_ENCODE_WGSL = /* wgsl */ `
// The swapchain is a plain unorm format, so nothing downstream gamma-encodes for us. Gamma 2.2
// rather than the exact sRGB curve: the scene's darkest colors (the sky's navy, faint stars) are
// tuned to it, and the sRGB curve's linear toe would crush them to black.
fn gammaEncode(color: vec3f) -> vec3f {
  return pow(max(color, vec3f(0.0)), vec3f(1.0 / 2.2));
}
`

// Per channel: x / (1 + x).
const REINHARD_WGSL = /* wgsl */ `
fn tonemap(color: vec3f) -> vec3f {
  return gammaEncode(color / (vec3f(1.0) + color));
}
`

// AgX (Troy Sobotka), in Benjamin Wrensch's minimal fit: compresses in a log space spanning
// 16.5 stops around middle gray and desaturates toward white the brighter a color gets, so bright
// light keeps its hue instead of skewing like per-channel curves do.
const AGX_BASE_WGSL = /* wgsl */ `
fn agxContrast(x: vec3f) -> vec3f {
  let x2 = x * x;
  let x4 = x2 * x2;
  return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
}

fn agxBase(color: vec3f) -> vec3f {
  let inset = mat3x3f(
    0.842479062253094, 0.0423282422610123, 0.0423756549057051,
    0.0784335999999992, 0.878468636469772, 0.0784336,
    0.0792237451477643, 0.0791661274605434, 0.879142973793104);
  let outset = mat3x3f(
    1.19687900512017, -0.0528968517574562, -0.0529716355144438,
    -0.0980208811401368, 1.15190312990417, -0.0980434501171241,
    -0.0990297440797205, -0.0989611768448433, 1.15107367264116);
  let minEv = -12.47393;
  let maxEv = 4.026069;
  let encoded = (clamp(log2(max(inset * color, vec3f(1e-10))), vec3f(minEv), vec3f(maxEv)) - minEv) / (maxEv - minEv);
  return outset * agxContrast(encoded);
}
`

// Its contrast curve already returns display-encoded values: no gamma on top.
const AGX_WGSL = /* wgsl */ `
${AGX_BASE_WGSL}
fn tonemap(color: vec3f) -> vec3f {
  return clamp(agxBase(color), vec3f(0.0), vec3f(1.0));
}
`

const TONEMAP_WGSL: Record<Tonemapper, string> = {
  reinhard: REINHARD_WGSL,
  agx: AGX_WGSL,
}

export function tonemapWgsl(tonemapper: Tonemapper): string {
  return GAMMA_ENCODE_WGSL + TONEMAP_WGSL[tonemapper]
}
