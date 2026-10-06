import { mat4, vec3 } from 'gl-matrix'
import { worldToScreen, type ScreenPosition, type ViewportSize } from './screenProjection'

export const VERTICAL_FOV_RADIANS = Math.PI / 4

// Must exceed the farthest thing the camera can see: at Realistic scale Neptune's orbit reaches
// ~606 units from the Sun and the orbit camera can back off to 700 units, so the far side of that
// orbit sits up to ~1300 units away. Depth precision depends almost only on the near plane.
const FAR_PLANE_DISTANCE = 2000

// The near plane must stay closer than the camera's closest zoom distance or it clips away the body
// the camera is framing: at Realistic scale the zoom floor shrinks to ~0.0005 units. 0.02 gives
// Compact scale's near plane of 0.1 (5 * 0.02) and shrinks proportionally from there.
const NEAR_PLANE_FRACTION_OF_MIN_RADIUS = 0.02

// lensShiftNdc moves the image vertically (in NDC, positive = up) without changing the perspective,
// so no angle in the scene changes - lessons use it to keep their scene above the lesson panel.
export function perspectiveProjection(aspect: number, minOrbitRadius: number, lensShiftNdc = 0): mat4 {
  const near = minOrbitRadius * NEAR_PLANE_FRACTION_OF_MIN_RADIUS
  const matrix = mat4.perspective(mat4.create(), VERTICAL_FOV_RADIANS, aspect, near, FAR_PLANE_DISTANCE)
  // Column-major: [9] multiplies view-space z into clip y, and clip w = -z, so this adds the shift
  // to every point's NDC y.
  matrix[9] = -lensShiftNdc
  return matrix
}

// Everything a frame needs to know about the camera it is rendered from.
export interface Viewpoint {
  view: mat4
  projection: mat4
  viewProjection: mat4
  // World-space eye position.
  position: vec3
  // Backing-store pixels (what the GPU renders) and CSS pixels (where DOM labels are placed).
  pixels: ViewportSize
  cssPixels: ViewportSize
}

export function createViewpoint(view: mat4, projection: mat4, canvas: HTMLCanvasElement): Viewpoint {
  return {
    view,
    projection,
    viewProjection: mat4.multiply(mat4.create(), projection, view),
    // A view matrix's translation column is the eye position rotated into view space, so invert.
    position: mat4.getTranslation(vec3.create(), mat4.invert(mat4.create(), view) ?? mat4.create()),
    pixels: { width: canvas.width, height: canvas.height },
    cssPixels: { width: canvas.clientWidth, height: canvas.clientHeight },
  }
}

// projection * (view * world): the multiplication order every body's uniforms have always used.
export function worldViewProjection(viewpoint: Viewpoint, world: mat4): mat4 {
  return mat4.multiply(mat4.create(), viewpoint.projection, mat4.multiply(mat4.create(), viewpoint.view, world))
}

export function projectToCss(viewpoint: Viewpoint, point: ArrayLike<number>): ScreenPosition {
  return worldToScreen(viewpoint.viewProjection, point, viewpoint.cssPixels)
}

export function projectToPixels(viewpoint: Viewpoint, point: ArrayLike<number>): ScreenPosition {
  return worldToScreen(viewpoint.viewProjection, point, viewpoint.pixels)
}
