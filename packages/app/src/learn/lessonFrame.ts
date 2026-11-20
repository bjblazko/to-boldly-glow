import { VERTICAL_FOV_RADIANS, type LensShift } from '../camera/viewpoint'
import type { ContentBounds } from './lessonShot'

// Where on the screen a lesson's scene goes, clear of the lesson panel: on a wide landscape screen
// the panel is a column on the right (an "L" with the bar below), elsewhere it sits above the bar.
// The numbers mirror .hud-lesson-panel in hud.css - keep the two in sync.

// The column: from this width and this aspect ratio on (hud.css: @media (min-width: 900px) and
// (min-aspect-ratio: 11/10)), 380px wide and 18px from the right edge, so 398px plus a gap; it
// stands on the bar.
const SIDE_PANEL_MIN_WIDTH_PX = 900
const SIDE_PANEL_MIN_ASPECT = 1.1
const SIDE_PANEL_RESERVED_PX = 414
// The bar at the bottom: 68px tall, 18px above the bottom edge.
const DOCK_RESERVED_PX = 86
// Above the bar, the panel's top rises at most to max(16px, 100% - 376px).
const LESSON_PANEL_RESERVED_PX = 376
const LESSON_PANEL_MIN_TOP_PX = 16
// The top bar (the Explore / Learn switch) covers the canvas's top 76px.
const TOP_BAR_RESERVED_PX = 76
const FIT_MARGIN = 0.04
const FIT_MARGIN_TOP = 0.05
// On short windows the panel covers most of the screen; the scene still gets at least the top half
// (the panel can be dragged aside).
const FIT_MIN_BAND_BOTTOM = 0.5
// Nor does the top bar squeeze the scene below this share of the screen: on short windows the
// scene reaches up beside the (narrow) mode switch instead.
const FIT_MIN_BAND_HEIGHT = 0.4

// A part of the screen, as fractions of its width (from the left) and height (from the top).
export interface ScreenRegion {
  left: number
  right: number
  top: number
  bottom: number
}

// The same test as CSS sees it, for the panel itself (hud.css uses min-aspect-ratio: 11/10).
export const SIDE_PANEL_MEDIA_QUERY = `(min-width: ${SIDE_PANEL_MIN_WIDTH_PX}px) and (min-aspect-ratio: 11/10)`

export function hasSidePanel(width: number, height: number): boolean {
  return width >= SIDE_PANEL_MIN_WIDTH_PX && width / height >= SIDE_PANEL_MIN_ASPECT
}

// The part of the screen the scene is fitted into.
export function sceneRegion(width: number, height: number): ScreenRegion {
  const side = hasSidePanel(width, height)
  const bottom = side ? 1 - DOCK_RESERVED_PX / height - FIT_MARGIN : Math.max(panelTop(height) - FIT_MARGIN, FIT_MIN_BAND_BOTTOM)
  const top = Math.max(FIT_MARGIN_TOP, Math.min(TOP_BAR_RESERVED_PX / height, bottom - FIT_MIN_BAND_HEIGHT))
  return side ? { left: FIT_MARGIN, right: 1 - SIDE_PANEL_RESERVED_PX / width - FIT_MARGIN, top, bottom } : { left: 0, right: 1, top, bottom }
}

// Above the bar, the panel's top edge at its tallest (a fraction of the height).
function panelTop(height: number): number {
  return Math.max(LESSON_PANEL_MIN_TOP_PX, height - LESSON_PANEL_RESERVED_PX) / height
}

export interface Framing {
  radius: number
  lensShift: LensShift
}

// Centres the content in the region with a lens shift (which changes no angle in the scene),
// backing the camera off only when the content is too tall or too wide for the region - never
// moving it closer than the preset, and at most maxZoomOut times farther. The content's middle is
// the target sideways (it reaches halfWidth either way) and `(top + bottom) / 2` above it.
export function fitToRegion(content: ContentBounds, screen: { region: ScreenRegion; aspect: number }, presetRadius: number, maxZoomOut: number): Framing {
  const { region, aspect } = screen
  const tanHalfFov = Math.tan(VERTICAL_FOV_RADIANS / 2)
  const halfHeightToFit = Math.max((content.top - content.bottom) / (2 * (region.bottom - region.top)), content.halfWidth / (aspect * (region.right - region.left)))
  const radius = Math.min(Math.max(presetRadius, halfHeightToFit / tanHalfFov), presetRadius * maxZoomOut)
  // A point y above the target lands at screen fraction 0.5 - y / (2 * halfHeight) - shift / 2
  // from the top; solve for the shift that puts the content's middle in the region's middle.
  // Sideways the target lands at 0.5 + shift / 2 from the left.
  const halfHeight = radius * tanHalfFov
  return {
    radius,
    lensShift: { x: region.left + region.right - 1, y: 1 - (region.top + region.bottom) - (content.top + content.bottom) / 2 / halfHeight },
  }
}
