import { vec3 } from 'gl-matrix'
import { COMPACT_MIN_ORBIT_RADIUS, type OrbitCamera } from '../camera/orbitCamera'
import type { CameraLens } from '../camera/cameraLens'
import { VERTICAL_FOV_RADIANS } from '../camera/viewpoint'
import { ECLIPTIC_NORTH } from '../solarSystem/poleOrientation'
import type { Vec3 } from '../math/tuples'
import type { Chapter } from './lessonTypes'
import { EARTH_STAGED_POSITION } from './seasons/seasonsScene'
import { LINEUP_PLANETS_EXTENT } from './sizes/sizesLineup'

type ChapterKind = Chapter['kind']

interface CameraPreset {
  target: Vec3
  radius: number
  azimuth: number
  elevation: number
  upAxis: Vec3
}

// Staged chapters: a true side profile. With world Y as the screen's up axis - exactly the axis
// Earth's tilt leans away from - the tilt reads as an honest left/right lean in every chapter, and
// elevation 0 keeps the view level instead of looking down on the equator. The target sits a few
// units toward the Sun so Earth moves left, clearing its southern hemisphere of the lesson panel,
// at the price of a slight (deliberately accepted) skew of the day/night line.
const STAGED_PRESET: CameraPreset = {
  target: [EARTH_STAGED_POSITION[0] - 4, 0, 0],
  radius: 13,
  azimuth: Math.PI / 2,
  elevation: 0,
  upAxis: [0, 1, 0],
}

// Orbit chapter: a fixed, shallow side view centered on the Sun, with the app's normal ecliptic-north
// up. The camera stays still while Earth visibly glides around (a camera tracking Earth made it look
// as if only the axis turned). The fixed axis leans within the world X-Z plane, so azimuth -PI/2
// (looking along Y) shows its lean undistorted at every point of the orbit, and the low elevation
// keeps the mostly-vertical axis from being foreshortened. Earth passes behind the Sun once a lap.
const ORBIT_PRESET: CameraPreset = {
  target: [0, 0, 0],
  radius: 22,
  azimuth: -Math.PI / 2,
  elevation: 0.18,
  upAxis: [...ECLIPTIC_NORTH],
}

// Sizes lineup: looking straight at the row (along +Z) with X horizontal, from just far enough to fit
// the planets' width across the screen.
const SIZES_FRAMING_MARGIN = 1.15

// The lesson panel covers the canvas's bottom; mirrors .hud-lesson-panel's
// `top: max(16px, calc(100% - 376px))` in hud.css - keep the two in sync.
const LESSON_PANEL_RESERVED_PX = 376
const LESSON_PANEL_MIN_TOP_PX = 16
const FIT_MARGIN_TOP = 0.05
const FIT_MARGIN_BOTTOM = 0.04
// On short windows the panel covers most of the screen; the scene still gets at least the top half
// (the panel can be dragged aside), and the camera backs off at most this far from the preset.
const FIT_MIN_BAND_BOTTOM = 0.5
const FIT_MAX_ZOOM_OUT = 2

// Each scene's extent around its camera target in scene units: vertically along the camera's up
// axis (what must stay above the panel) and the farthest it reaches to either side (what must fit
// across a narrow portrait screen).
const CONTENT_BOUNDS: Record<ChapterKind, { top: number; bottom: number; halfWidth: number }> = {
  // The axis's north end and label; Earth's southern limb and Location B; Earth's far limb and labels.
  staged: { top: 4.4, bottom: -2.7, halfWidth: 7.2 },
  // The axis above and below the orbit ellipse; sideways, the orbit circle plus labels.
  orbit: { top: 5.2, bottom: -5.2, halfWidth: 15 },
  // The lineup row and the labels under it; its width is already fitted by the preset.
  sizes: { top: 0.02, bottom: -0.02, halfWidth: 0 },
}

// Points the orbit camera at a lesson chapter's scene. Each chapter kind has a fixed shot, applied
// once when the kind changes - never every chapter - so the camera stays still while a chapter's
// scene animates.
export class LessonCamera {
  constructor(
    private readonly orbit: OrbitCamera,
    private readonly lens: CameraLens,
    private readonly canvas: HTMLCanvasElement,
  ) {}

  frame(kind: ChapterKind): void {
    this.applyPreset(kind === 'orbit' ? ORBIT_PRESET : kind === 'sizes' ? this.sizesPreset() : STAGED_PRESET)
    // Lessons ignore the explore view's scale: the lineup is at true scale (the Sun's radius there is
    // ~0.09 units), so its zoom floor and near plane come from its own framing distance; the seasons
    // scenes are drawn at Compact sizes.
    this.lens.setLessonZoomFloor(kind === 'sizes' ? this.orbit.radius * 0.01 : COMPACT_MIN_ORBIT_RADIUS)
    this.fitAbovePanel(kind)
  }

  release(): void {
    this.lens.setLessonZoomFloor(null)
    this.lens.lensShiftNdc = 0
    this.orbit.radius = Math.max(this.orbit.radius, this.orbit.minRadius)
  }

  private applyPreset(preset: CameraPreset): void {
    vec3.set(this.orbit.target, ...preset.target)
    this.orbit.radius = preset.radius
    this.orbit.azimuth = preset.azimuth
    this.orbit.elevation = preset.elevation
    vec3.set(this.orbit.upAxis, ...preset.upAxis)
  }

  private sizesPreset(): CameraPreset {
    const { minX, maxX } = LINEUP_PLANETS_EXTENT
    const halfWidthPerUnitDistance = Math.tan(VERTICAL_FOV_RADIANS / 2) * (this.canvas.width / this.canvas.height)
    return {
      target: [(minX + maxX) / 2, 0, 0],
      radius: ((maxX - minX) * SIZES_FRAMING_MARGIN) / 2 / halfWidthPerUnitDistance,
      azimuth: Math.PI / 2,
      elevation: 0.1,
      upAxis: [0, 1, 0],
    }
  }

  // Centers the scene in the band of the screen above the lesson panel with a lens shift (which
  // changes no angle in the scene), backing the camera off only when the content is too tall for
  // the band or too wide for the screen - never moving it closer than the preset.
  private fitAbovePanel(kind: ChapterKind): void {
    const height = this.canvas.clientHeight
    if (height <= 0) return
    const panelTop = Math.max(LESSON_PANEL_MIN_TOP_PX, height - LESSON_PANEL_RESERVED_PX) / height
    const band = { top: FIT_MARGIN_TOP, bottom: Math.max(panelTop - FIT_MARGIN_BOTTOM, FIT_MIN_BAND_BOTTOM) }
    const content = CONTENT_BOUNDS[kind]
    const tanHalfFov = Math.tan(VERTICAL_FOV_RADIANS / 2)
    const halfHeightToFit = Math.max(
      (content.top - content.bottom) / (2 * (band.bottom - band.top)),
      content.halfWidth / (this.canvas.clientWidth / height),
    )
    const presetRadius = this.orbit.radius
    this.orbit.radius = Math.min(Math.max(presetRadius, halfHeightToFit / tanHalfFov), presetRadius * FIT_MAX_ZOOM_OUT)
    // A point y above the target lands at screen fraction 0.5 - y / (2 * halfHeight) - shift / 2
    // from the top; solve for the shift that puts the content's middle in the band's middle.
    const halfHeight = this.orbit.radius * tanHalfFov
    this.lens.lensShiftNdc = 1 - (band.top + band.bottom) - (content.top + content.bottom) / 2 / halfHeight
  }
}
