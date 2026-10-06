import type { Page } from '@playwright/test'

// Headless Chromium can't give a WebGPU canvas a real swapchain ("Could not find
// SharedImageBackingFactory ... WebgpuSwapChainTexture"): the first getCurrentTexture() loses the
// device, so the app silently stops rendering after its first frame. This init script swaps the
// canvas swapchain for an ordinary offscreen texture of the same size and format, so every frame is
// really rendered - GPU validation errors surface as page errors - and the last frame can be read
// back for pixel assertions.
const OFFSCREEN_SWAPCHAIN = `(() => {
  const state = { device: null, format: null, texture: null, request: null, adapters: [] }
  window.__offscreenSwapchain = state
  const requestAdapter = GPU.prototype.requestAdapter
  GPU.prototype.requestAdapter = async function (...args) {
    const adapter = await requestAdapter.apply(this, args)
    if (adapter) state.adapters.push(adapter)
    return adapter
  }
  GPUCanvasContext.prototype.configure = function (config) {
    state.device = config.device
    state.format = config.format
    state.canvas = this.canvas
  }
  GPUCanvasContext.prototype.unconfigure = function () {}
  GPUCanvasContext.prototype.getCurrentTexture = function () {
    const { width, height } = state.canvas
    if (!state.texture || state.texture.width !== width || state.texture.height !== height) {
      state.texture?.destroy()
      state.texture = state.device.createTexture({
        label: 'offscreen swapchain',
        size: [width, height],
        format: state.format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.TEXTURE_BINDING,
      })
    }
    return state.texture
  }
  const submit = GPUQueue.prototype.submit
  GPUQueue.prototype.submit = function (commandBuffers) {
    const result = submit.call(this, commandBuffers)
    const request = state.request
    if (request && state.texture && state.device && this === state.device.queue) {
      state.request = null
      readBack(request)
    }
    return result
  }
  function readBack(request) {
    const texture = state.texture
    const { width, height } = texture
    const bytesPerRow = Math.ceil((width * 4) / 256) * 256
    const buffer = state.device.createBuffer({ size: bytesPerRow * height, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ })
    const encoder = state.device.createCommandEncoder()
    encoder.copyTextureToBuffer({ texture }, { buffer, bytesPerRow }, [width, height])
    submit.call(state.device.queue, [encoder.finish()])
    buffer.mapAsync(GPUMapMode.READ).then(() => {
      const source = new Uint8Array(buffer.getMappedRange())
      const bgra = state.format.startsWith('bgra')
      const rgba = new Uint8Array(width * height * 4)
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const from = y * bytesPerRow + x * 4
          const to = (y * width + x) * 4
          rgba[to] = source[from + (bgra ? 2 : 0)]
          rgba[to + 1] = source[from + 1]
          rgba[to + 2] = source[from + (bgra ? 0 : 2)]
          rgba[to + 3] = 255
        }
      }
      buffer.unmap()
      buffer.destroy()
      let binary = ''
      for (let i = 0; i < rgba.length; i += 0x8000) binary += String.fromCharCode(...rgba.subarray(i, i + 0x8000))
      request.resolve({ width, height, base64: btoa(binary) })
    }, request.reject)
  }
})()`

export interface CapturedFrame {
  width: number
  height: number
  pixels: Uint8Array
}

export async function installOffscreenSwapchain(page: Page): Promise<void> {
  await page.addInitScript(OFFSCREEN_SWAPCHAIN)
}

// Reads back the next frame the app submits. With Playwright's fake clock installed the app only
// renders when the clock advances, so pass advanceClock to step it by one frame.
export async function captureNextFrame(page: Page, { advanceClock = false } = {}): Promise<CapturedFrame> {
  const pending = page.evaluate(
    () =>
      new Promise<{ width: number; height: number; base64: string }>((resolve, reject) => {
        ;(window as unknown as { __offscreenSwapchain: { request: unknown } }).__offscreenSwapchain.request = { resolve, reject }
      }),
  )
  if (advanceClock) await page.clock.runFor(17)
  const frame = await pending
  return { width: frame.width, height: frame.height, pixels: new Uint8Array(Buffer.from(frame.base64, 'base64')) }
}

// Mean luminance (0-255) of the pixels inside a circle, in backing-store pixel coordinates.
export function meanLuminance(frame: CapturedFrame, centerX: number, centerY: number, radius: number): number {
  let sum = 0
  let count = 0
  for (let y = Math.max(0, Math.floor(centerY - radius)); y <= Math.min(frame.height - 1, Math.ceil(centerY + radius)); y++) {
    for (let x = Math.max(0, Math.floor(centerX - radius)); x <= Math.min(frame.width - 1, Math.ceil(centerX + radius)); x++) {
      if ((x - centerX) ** 2 + (y - centerY) ** 2 > radius ** 2) continue
      const i = (y * frame.width + x) * 4
      sum += 0.2126 * frame.pixels[i] + 0.7152 * frame.pixels[i + 1] + 0.0722 * frame.pixels[i + 2]
      count++
    }
  }
  return count === 0 ? 0 : sum / count
}
