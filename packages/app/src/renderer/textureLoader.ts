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
