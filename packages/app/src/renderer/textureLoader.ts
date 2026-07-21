import { generateMipmaps } from './mipmapGenerator'

// Loads a body's albedo texture from a URL and uploads it to the GPU, generating a full mip chain
// so small/distant spheres don't alias or shimmer under minification (see docs/roadmap.md's
// "Planet texture mipmaps" entry). Any failure (network error, non-OK response, decode failure)
// degrades gracefully to a 1x1 white texture rather than blocking rendering (see docs/superpowers/
// specs/2026-07-17-to-boldly-glow-mvp-design.md §6). Because the fragment shader samples this
// texture and multiplies it by the body's flat `color` uniform, a white fallback reproduces exactly
// the pre-texture flat-shaded appearance with no shader-side branch needed.
export async function loadBodyTexture(
  device: GPUDevice,
  url: string,
  mipPipeline: GPURenderPipeline,
  mipSampler: GPUSampler,
): Promise<GPUTexture> {
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status} loading ${url}`)
    const bitmap = await createImageBitmap(await response.blob())
    const mipLevelCount = 1 + Math.floor(Math.log2(Math.max(bitmap.width, bitmap.height)))
    const texture = device.createTexture({
      label: `texture ${url}`,
      size: [bitmap.width, bitmap.height],
      format: 'rgba8unorm-srgb',
      mipLevelCount,
      // RENDER_ATTACHMENT is required alongside COPY_DST for copyExternalImageToTexture's
      // destination, and is also what lets generateMipmaps blit into each subsequent mip level.
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    })
    device.queue.copyExternalImageToTexture({ source: bitmap }, { texture }, [bitmap.width, bitmap.height])
    generateMipmaps(device, texture, mipLevelCount, mipPipeline, mipSampler)
    return texture
  } catch (error) {
    console.warn(`Texture load failed for ${url}, falling back to flat shading.`, error)
    return createFallbackWhiteTexture(device)
  }
}

// Exported for callers that intentionally have no texture to load at all (e.g. a moon with no
// public-domain full-sphere map available — see solarSystem/moons.ts) and want the same flat,
// `color`-tinted appearance without a network round-trip or a load-failure warning.
export function createFallbackWhiteTexture(device: GPUDevice): GPUTexture {
  const texture = device.createTexture({
    label: 'fallback white texture',
    size: [1, 1],
    format: 'rgba8unorm-srgb',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  })
  device.queue.writeTexture({ texture }, new Uint8Array([255, 255, 255, 255]), { bytesPerRow: 4 }, [1, 1])
  return texture
}

// A neutral 1x1 "flat" height map for bodies with no bumpMapUrl — every finite-difference sample
// applyBump takes from this texture is identical, so it perturbs nothing and contributes zero
// ambient-occlusion darkening, exactly reproducing today's un-bumped appearance.
export function createFallbackFlatBumpTexture(device: GPUDevice): GPUTexture {
  const texture = device.createTexture({
    label: 'fallback flat bump texture',
    size: [1, 1],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  })
  device.queue.writeTexture({ texture }, new Uint8Array([128, 128, 128, 255]), { bytesPerRow: 4 }, [1, 1])
  return texture
}

// Loads a body's bump/height-map texture from a URL. Unlike loadBodyTexture, this does NOT use an
// sRGB format: height-map data is non-color numeric data (raw grayscale height values), not
// gamma-encoded light intensity, so it must be read back byte-for-byte with no gamma decode curve
// applied on sample. It also skips the mip chain entirely (mipLevelCount: 1) — applyBump in
// shaders.ts always samples this texture at an explicit mip level via textureSampleLevel(...,
// 0.0), so generating further mips for it would be pure wasted GPU work at load time. Any failure
// (network error, non-OK response, decode failure) degrades gracefully to a flat 1x1 height map
// rather than blocking rendering, matching loadBodyTexture's fallback strategy.
export async function loadBumpTexture(device: GPUDevice, url: string): Promise<GPUTexture> {
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status} loading ${url}`)
    const bitmap = await createImageBitmap(await response.blob())
    const texture = device.createTexture({
      label: `texture ${url}`,
      size: [bitmap.width, bitmap.height],
      format: 'rgba8unorm',
      mipLevelCount: 1,
      // RENDER_ATTACHMENT is required here even though this texture has no mip chain to blit into:
      // Dawn (Chrome's WebGPU backend) implements copyExternalImageToTexture's format/color-space
      // conversion internally via a render pass, so it validates the destination has RENDER_ATTACHMENT
      // regardless of whether the *caller* does any rendering into it ("Destination texture needs to
      // have CopyDst and RenderAttachment usage" GPUValidationError otherwise) — this is independent
      // of generateMipmaps' own (unrelated) use of RENDER_ATTACHMENT for its mip-blit chain.
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    })
    device.queue.copyExternalImageToTexture({ source: bitmap }, { texture }, [bitmap.width, bitmap.height])
    return texture
  } catch (error) {
    console.warn(`Texture load failed for ${url}, falling back to flat shading.`, error)
    return createFallbackFlatBumpTexture(device)
  }
}
