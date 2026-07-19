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
