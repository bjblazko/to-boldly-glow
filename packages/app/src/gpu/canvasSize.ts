export interface CanvasSize {
  width: number
  height: number
}

// Computes the backing-store pixel size a canvas should have to render crisply at its
// CSS-determined display size, accounting for device pixel ratio. Clamped to a minimum of 1 in
// each dimension — a canvas with a zero-size backing store (e.g. measured before layout, or in a
// hidden tab) would make WebGPU texture creation throw a validation error.
export function computeCanvasSize(clientWidth: number, clientHeight: number, devicePixelRatio: number): CanvasSize {
  return {
    width: Math.max(1, Math.round(clientWidth * devicePixelRatio)),
    height: Math.max(1, Math.round(clientHeight * devicePixelRatio)),
  }
}

// Matches the canvas's backing store to its CSS display size. Returns false, leaving the canvas
// untouched, when it already matches, so callers can skip recreating size-dependent GPU resources.
export function fitCanvasToDisplaySize(canvas: HTMLCanvasElement): boolean {
  const { width, height } = computeCanvasSize(canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio || 1)
  if (canvas.width === width && canvas.height === height) return false
  canvas.width = width
  canvas.height = height
  return true
}

// Calls onResize whenever the canvas's display size changes - window resizes, but also layout
// changes and device-pixel-ratio changes (moving the window to another screen), which fire no
// window resize event. Observing device pixels is not supported everywhere, hence the fallback.
export function watchCanvasSize(canvas: HTMLCanvasElement, onResize: () => void): void {
  const observer = new ResizeObserver(() => {
    if (fitCanvasToDisplaySize(canvas)) onResize()
  })
  try {
    observer.observe(canvas, { box: 'device-pixel-content-box' })
  } catch {
    observer.observe(canvas)
  }
}
