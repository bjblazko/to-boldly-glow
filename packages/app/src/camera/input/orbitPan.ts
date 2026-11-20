import { vec3 } from 'gl-matrix'
import { walkDistance, type OrbitCamera } from '../orbitCamera'
import type { LensShift } from '../viewpoint'

// What turns screen pixels into world distances at the pivot: the canvas's height in CSS pixels,
// its aspect ratio, the lens shift lessons use to keep their scene clear of the panel, and the
// tangent of half the vertical field of view.
// Walking, sideways moves are measured on a plane this far ahead (metres).
const WALK_PAN_DEPTH = 1

export interface ScreenFrame {
  heightPx: number
  aspect: number
  lensShift: LensShift
  tanHalfFov: number
}

// Moves the pivot so the scene follows the pointer by (dx, dy) CSS pixels, measured on the plane
// through the pivot facing the camera.
export function panByPixels(camera: OrbitCamera, dxPx: number, dyPx: number, screen: ScreenFrame): void {
  // Walking, the room moves as a wall a little way off would.
  const depth = camera.walk ? WALK_PAN_DEPTH : camera.radius
  const worldPerPx = (2 * depth * screen.tanHalfFov) / screen.heightPx
  const { right, up } = camera.screenAxes()
  const delta = vec3.scale(vec3.create(), right, -dxPx * worldPerPx)
  vec3.scaleAndAdd(delta, delta, up, dyPx * worldPerPx)
  camera.shiftPivot(delta)
}

// Zooms by `factor` (below 1 moves in) so the point under the pointer (`ndc`, or the middle when
// null) stays where it is on screen. Only the zoom actually applied - the radius may be clamped -
// moves the pivot.
export function zoomToward(camera: OrbitCamera, factor: number, ndc: [number, number] | null, screen: ScreenFrame): void {
  if (camera.walk) return walkToward(camera, factor, ndc, screen)
  const before = camera.radius
  const { right, up } = camera.screenAxes()
  camera.zoomBy(factor)
  if (!ndc) return
  const applied = camera.radius / before
  // From the pivot to the point under the pointer; the pivot moves toward it by (1 - applied).
  const toPoint = vec3.scale(vec3.create(), right, (ndc[0] - screen.lensShift.x) * screen.tanHalfFov * screen.aspect * before)
  vec3.scaleAndAdd(toPoint, toPoint, up, (ndc[1] - screen.lensShift.y) * screen.tanHalfFov * before)
  camera.shiftPivot(vec3.scale(toPoint, toPoint, 1 - applied))
}

// Walking, a zoom steps toward what is under the pointer (or straight ahead).
function walkToward(camera: OrbitCamera, factor: number, ndc: [number, number] | null, screen: ScreenFrame): void {
  if (!ndc) return camera.zoomBy(factor)
  const { right, up } = camera.screenAxes()
  const direction = camera.forward()
  vec3.scaleAndAdd(direction, direction, right, (ndc[0] - screen.lensShift.x) * screen.tanHalfFov * screen.aspect)
  vec3.scaleAndAdd(direction, direction, up, (ndc[1] - screen.lensShift.y) * screen.tanHalfFov)
  vec3.normalize(direction, direction)
  camera.step(direction, walkDistance(factor))
}

export function clientToNdc(x: number, y: number, rect: { left: number; top: number; width: number; height: number }): [number, number] {
  return [((x - rect.left) / rect.width) * 2 - 1, 1 - ((y - rect.top) / rect.height) * 2]
}
