import { vec3 } from 'gl-matrix'
import type { OrbitCamera } from '../orbitCamera'
import { VERTICAL_FOV_RADIANS } from '../viewpoint'

// What turns screen pixels into world distances at the pivot: the canvas's height in CSS pixels,
// its aspect ratio, and the lens shift lessons use to keep their scene above the panel.
export interface ScreenFrame {
  heightPx: number
  aspect: number
  lensShiftNdc: number
}

const TAN_HALF_FOV = Math.tan(VERTICAL_FOV_RADIANS / 2)

// Moves the pivot so the scene follows the pointer by (dx, dy) CSS pixels, measured on the plane
// through the pivot facing the camera.
export function panByPixels(camera: OrbitCamera, dxPx: number, dyPx: number, screen: ScreenFrame): void {
  const worldPerPx = (2 * camera.radius * TAN_HALF_FOV) / screen.heightPx
  const { right, up } = camera.screenAxes()
  const delta = vec3.scale(vec3.create(), right, -dxPx * worldPerPx)
  vec3.scaleAndAdd(delta, delta, up, dyPx * worldPerPx)
  camera.shiftPivot(delta)
}

// Zooms by `factor` (below 1 moves in) so the point under the pointer (`ndc`, or the middle when
// null) stays where it is on screen. Only the zoom actually applied - the radius may be clamped -
// moves the pivot.
export function zoomToward(camera: OrbitCamera, factor: number, ndc: [number, number] | null, screen: ScreenFrame): void {
  const before = camera.radius
  const { right, up } = camera.screenAxes()
  camera.zoomBy(factor)
  if (!ndc) return
  const applied = camera.radius / before
  // From the pivot to the point under the pointer; the pivot moves toward it by (1 - applied).
  const toPoint = vec3.scale(vec3.create(), right, ndc[0] * TAN_HALF_FOV * screen.aspect * before)
  vec3.scaleAndAdd(toPoint, toPoint, up, (ndc[1] - screen.lensShiftNdc) * TAN_HALF_FOV * before)
  camera.shiftPivot(vec3.scale(toPoint, toPoint, 1 - applied))
}

export function clientToNdc(x: number, y: number, rect: { left: number; top: number; width: number; height: number }): [number, number] {
  return [((x - rect.left) / rect.width) * 2 - 1, 1 - ((y - rect.top) / rect.height) * 2]
}
