export interface ScreenPosition {
  x: number
  y: number
  visible: boolean
}

// Projects a world-space point through a combined view-projection matrix (column-major,
// matching gl-matrix's mat4 and WGSL's mat4x4 memory layout — the same convention the renderer
// already relies on when uploading matrices to shader uniforms) into canvas pixel coordinates.
// `visible` is false when the point is behind the camera (clip-space w <= 0) or far enough
// outside the view frustum that a label there wouldn't correspond to anything on screen.
export function worldToScreen(
  viewProjection: ArrayLike<number>,
  worldX: number,
  worldY: number,
  worldZ: number,
  canvasWidth: number,
  canvasHeight: number,
): ScreenPosition {
  const clipX =
    viewProjection[0] * worldX + viewProjection[4] * worldY + viewProjection[8] * worldZ + viewProjection[12]
  const clipY =
    viewProjection[1] * worldX + viewProjection[5] * worldY + viewProjection[9] * worldZ + viewProjection[13]
  const clipW =
    viewProjection[3] * worldX + viewProjection[7] * worldY + viewProjection[11] * worldZ + viewProjection[15]

  if (clipW <= 0) {
    return { x: 0, y: 0, visible: false }
  }

  const ndcX = clipX / clipW
  const ndcY = clipY / clipW

  const x = (ndcX * 0.5 + 0.5) * canvasWidth
  // NDC +Y points up; canvas/CSS +Y points down.
  const y = (1 - (ndcY * 0.5 + 0.5)) * canvasHeight

  // A small margin beyond [-1, 1] keeps labels visible while their body is still just off-screen,
  // rather than popping in/out exactly at the frustum edge.
  const margin = 1.2
  const visible = ndcX >= -margin && ndcX <= margin && ndcY >= -margin && ndcY <= margin

  return { x, y, visible }
}
