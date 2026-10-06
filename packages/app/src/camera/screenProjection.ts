export interface ScreenPosition {
  x: number
  y: number
  visible: boolean
}

export interface ViewportSize {
  width: number
  height: number
}

// A small margin beyond [-1, 1] keeps labels visible while their body is still just off-screen,
// rather than popping in/out exactly at the frustum edge.
const VISIBLE_NDC_MARGIN = 1.2

// Projects a world-space point through a column-major view-projection matrix (gl-matrix's and
// WGSL's layout) into viewport coordinates (+y down). `visible` is false when the point is behind
// the camera or so far outside the frustum that a label there would not belong to anything on screen.
export function worldToScreen(viewProjection: ArrayLike<number>, point: ArrayLike<number>, viewport: ViewportSize): ScreenPosition {
  const x = point[0]
  const y = point[1]
  const z = point[2]
  const clipX = viewProjection[0] * x + viewProjection[4] * y + viewProjection[8] * z + viewProjection[12]
  const clipY = viewProjection[1] * x + viewProjection[5] * y + viewProjection[9] * z + viewProjection[13]
  const clipW = viewProjection[3] * x + viewProjection[7] * y + viewProjection[11] * z + viewProjection[15]
  if (clipW <= 0) return { x: 0, y: 0, visible: false }

  const ndcX = clipX / clipW
  const ndcY = clipY / clipW
  return {
    x: (ndcX * 0.5 + 0.5) * viewport.width,
    y: (1 - (ndcY * 0.5 + 0.5)) * viewport.height,
    visible: Math.abs(ndcX) <= VISIBLE_NDC_MARGIN && Math.abs(ndcY) <= VISIBLE_NDC_MARGIN,
  }
}
