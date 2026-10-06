import { MipmapGenerator } from './mipmaps'

const COLOR_TEXTURE_FORMAT: GPUTextureFormat = 'rgba8unorm-srgb'
const HEIGHT_TEXTURE_FORMAT: GPUTextureFormat = 'rgba8unorm'

// Loads textures from URLs. Any failure (network error, non-OK response, decode failure) degrades
// to a neutral 1x1 fallback instead of blocking rendering (see the MVP design spec's §6): white for
// color maps (the body's flat `color` tint then shows unchanged), mid-gray for height maps (no bump).
export class TextureLoader {
  private constructor(
    private readonly device: GPUDevice,
    private readonly mipmaps: MipmapGenerator,
  ) {}

  static async create(device: GPUDevice): Promise<TextureLoader> {
    return new TextureLoader(device, await MipmapGenerator.create(device, COLOR_TEXTURE_FORMAT))
  }

  // sRGB color map with a full mip chain, so small or distant spheres don't shimmer when minified.
  async loadColor(url: string): Promise<GPUTexture> {
    try {
      const bitmap = await fetchBitmap(url)
      const mipLevelCount = 1 + Math.floor(Math.log2(Math.max(bitmap.width, bitmap.height)))
      const texture = this.upload(bitmap, url, COLOR_TEXTURE_FORMAT, mipLevelCount)
      this.mipmaps.generate(texture)
      return texture
    } catch (error) {
      console.warn(`Texture load failed for ${url}, falling back to flat shading.`, error)
      return this.white()
    }
  }

  // Height maps are numeric data, not light, so they are read back without an sRGB decode - and
  // without mips, since the bump shader always samples level 0.
  async loadHeight(url: string): Promise<GPUTexture> {
    try {
      return this.upload(await fetchBitmap(url), url, HEIGHT_TEXTURE_FORMAT, 1)
    } catch (error) {
      console.warn(`Texture load failed for ${url}, falling back to flat shading.`, error)
      return this.flatHeight()
    }
  }

  white(): GPUTexture {
    return this.solidPixel('fallback white texture', COLOR_TEXTURE_FORMAT, [255, 255, 255, 255])
  }

  flatHeight(): GPUTexture {
    return this.solidPixel('fallback flat bump texture', HEIGHT_TEXTURE_FORMAT, [128, 128, 128, 255])
  }

  // RENDER_ATTACHMENT is required next to COPY_DST even without mip generation: Dawn implements
  // copyExternalImageToTexture's format conversion with a render pass and validates the usage.
  private upload(bitmap: ImageBitmap, url: string, format: GPUTextureFormat, mipLevelCount: number): GPUTexture {
    const size = [bitmap.width, bitmap.height]
    const usage = GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
    const texture = this.device.createTexture({ label: `texture ${url}`, size, format, mipLevelCount, usage })
    this.device.queue.copyExternalImageToTexture({ source: bitmap }, { texture }, size)
    return texture
  }

  private solidPixel(label: string, format: GPUTextureFormat, rgba: number[]): GPUTexture {
    const usage = GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
    const texture = this.device.createTexture({ label, size: [1, 1], format, usage })
    this.device.queue.writeTexture({ texture }, new Uint8Array(rgba), { bytesPerRow: 4 }, [1, 1])
    return texture
  }
}

async function fetchBitmap(url: string): Promise<ImageBitmap> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status} loading ${url}`)
  return createImageBitmap(await response.blob())
}
