export interface GpuContext {
  // Held for the device's whole lifetime: Chromium can lose the device ("A valid external Instance
  // reference no longer exists") once the adapter it came from is garbage-collected.
  adapter: GPUAdapter
  device: GPUDevice
  context: GPUCanvasContext
  format: GPUTextureFormat
}

export async function initWebGpu(canvas: HTMLCanvasElement): Promise<GpuContext> {
  const adapter = await requestAdapter()
  const device = await adapter.requestDevice()
  rethrowUncapturedErrors(device)
  const context = canvas.getContext('webgpu')
  if (!context) throw new Error('Failed to get a WebGPU canvas context.')
  const format = navigator.gpu.getPreferredCanvasFormat()
  context.configure({ device, format })
  return { adapter, device, context, format }
}

async function requestAdapter(): Promise<GPUAdapter> {
  if (!navigator.gpu) throw new Error('WebGPU is not supported in this browser.')
  const adapter = await navigator.gpu.requestAdapter()
  if (!adapter) throw new Error('No WebGPU adapter available.')
  return adapter
}

// Validation errors raised during encoding/submission (e.g. a pipeline whose sample count doesn't
// match its pass) arrive asynchronously as uncapturederror events, not as exceptions: left alone,
// the invalid command buffer is dropped while rendering silently goes on. Re-throwing turns them
// into uncaught errors, which browsers and Playwright's `pageerror` both report.
function rethrowUncapturedErrors(device: GPUDevice): void {
  device.addEventListener('uncapturederror', (event) => {
    throw new Error(`WebGPU error: ${event.error.message}`, { cause: event.error })
  })
}

// A lost device (driver reset, GPU process crash, the browser reclaiming resources) renders nothing
// from then on, without any error. Destroying the device ourselves is not a loss worth reporting.
export function onDeviceLost(device: GPUDevice, handleLoss: (message: string) => void): void {
  void device.lost.then((info) => {
    if (info.reason !== 'destroyed') handleLoss(info.message)
  })
}
