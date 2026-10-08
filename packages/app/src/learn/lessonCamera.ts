import { vec3 } from 'gl-matrix'
import { COMPACT_MIN_ORBIT_RADIUS, orbitBasisForUpAxis, type OrbitCamera } from '../camera/orbitCamera'
import type { CameraLens } from '../camera/cameraLens'
import { VERTICAL_FOV_RADIANS } from '../camera/viewpoint'
import { ECLIPTIC_NORTH } from '../solarSystem/poleOrientation'
import { pointAlong, type Vec3 } from '../math/tuples'
import { EARTH_POSITION } from './eclipse/eclipseGeometry'
import { PHASES_EARTH_POSITION } from './phases/phasesGeometry'
import { directionAtAltitude, lookAltitudeDegrees, type GroundShot } from './ground/groundShot'
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

// The eclipse lesson from space: a side view of the Sun, the Moon's orbit and Earth, a little
// above the plane of Earth's orbit so the Moon's orbit opens up into an ellipse.
const ECLIPSE_ORBIT_PRESET: CameraPreset = {
  target: [23, 0, 0],
  radius: 42,
  azimuth: -Math.PI / 2,
  elevation: 0.14,
  upAxis: [...ECLIPTIC_NORTH],
}

// The Moon's shadow on Earth: Earth's day side, seen from the Sun's side but from 30 degrees above
// the Sun-Earth line - far enough off it that the Moon, passing between the Sun and Earth, stays out
// of the picture (and doesn't hide its own shadow). Backing off would bring the Moon into view, so
// this camera never does.
const ECLIPSE_SHADOW_PRESET: CameraPreset = {
  target: EARTH_POSITION,
  radius: 9,
  azimuth: Math.PI,
  elevation: Math.PI / 6,
  upAxis: [...ECLIPTIC_NORTH],
}

// The Moon's phases from above: Earth in the middle of the Moon's orbit, the Sun far off to the left
// (sunlight comes from the left), seen from high above the north side of Earth's orbit.
const PHASES_ORBIT_PRESET: CameraPreset = {
  target: PHASES_EARTH_POSITION,
  radius: 26,
  azimuth: -Math.PI / 2,
  elevation: 1.25,
  upAxis: [...ECLIPTIC_NORTH],
}

// The full Moon passing Earth's shadow: from the side, nearly in the plane of Earth's orbit and far
// enough away that the Moon's tilted orbit shows edge-on, as a slanted line.
const PHASES_SHADOW_PRESET: CameraPreset = {
  target: [PHASES_EARTH_POSITION[0] + 8, 0, -1],
  radius: 44,
  azimuth: -Math.PI / 2,
  elevation: 0.04,
  upAxis: [...ECLIPTIC_NORTH],
}

// How far the camera may back off from a shot's preset, where that differs from FIT_MAX_ZOOM_OUT:
// the shadow close-up stays exactly where its preset puts it, however little room the panel leaves,
// and so does every view from the ground (its eye is the observer); the long eclipse diagram backs
// off further to fit a portrait screen.
const MAX_ZOOM_OUT: Partial<Record<ChapterKind, number>> = { eclipseShadow: 1, eclipseOrbit: 4, phasesOrbit: 3, phasesShadow: 3 }

// Every shot but the sizes lineup (fitted to the screen) and the views from the ground (see
// groundPreset).
const FIXED_PRESETS: Partial<Record<ChapterKind, CameraPreset>> = {
  staged: STAGED_PRESET,
  orbit: ORBIT_PRESET,
  eclipseOrbit: ECLIPSE_ORBIT_PRESET,
  eclipseShadow: ECLIPSE_SHADOW_PRESET,
  phasesOrbit: PHASES_ORBIT_PRESET,
  phasesShadow: PHASES_SHADOW_PRESET,
}

// From the ground: standing at the shot's eye and looking toward the middle of what it must show,
// with the horizon level.
const GROUND_TARGET_DISTANCE = 10

function groundPreset(shot: GroundShot): CameraPreset {
  const look = directionAtAltitude(shot, lookAltitudeDegrees(shot))
  const { right, forward0 } = orbitBasisForUpAxis(shot.zenith)
  const back = look.map((value) => -value) as Vec3
  const dot = (a: ArrayLike<number>, b: ArrayLike<number>) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  return {
    target: pointAlong(shot.eye, look, GROUND_TARGET_DISTANCE),
    radius: GROUND_TARGET_DISTANCE,
    azimuth: Math.atan2(dot(back, right), dot(back, forward0)),
    elevation: Math.asin(dot(back, shot.zenith)),
    upAxis: shot.zenith,
  }
}

// From the look direction, up to the shot's top altitude and down to its bottom one.
function groundBounds(shot: GroundShot): ContentBounds {
  const look = lookAltitudeDegrees(shot)
  const across = (degrees: number) => GROUND_TARGET_DISTANCE * Math.tan((degrees * Math.PI) / 180)
  return { top: across(shot.altitudes.top - look), bottom: -across(look - shot.altitudes.bottom), halfWidth: across(GROUND_HALF_WIDTH_DEGREES) }
}

const GROUND_HALF_WIDTH_DEGREES = 12

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

interface ContentBounds {
  top: number
  bottom: number
  halfWidth: number
}

// Each scene's extent around its camera target in scene units: vertically along the camera's up
// axis (what must stay above the panel) and the farthest it reaches to either side (what must fit
// across a narrow portrait screen). The views from the ground take theirs from their shot.
const CONTENT_BOUNDS: Partial<Record<ChapterKind, ContentBounds>> = {
  // The axis's north end and label; Earth's southern limb and Location B; Earth's far limb and labels.
  staged: { top: 4.4, bottom: -2.7, halfWidth: 7.2 },
  // The axis above and below the orbit ellipse; sideways, the orbit circle plus labels.
  orbit: { top: 5.2, bottom: -5.2, halfWidth: 15 },
  // The lineup row and the labels under it; its width is already fitted by the preset.
  sizes: { top: 0.02, bottom: -0.02, halfWidth: 0 },
  // The Moon's orbit above and below Earth; from the Sun's far edge to the Moon's orbit past Earth.
  eclipseOrbit: { top: 4.5, bottom: -4, halfWidth: 30 },
  // Earth, where the shadow crosses it.
  eclipseShadow: { top: 1.8, bottom: -2.1, halfWidth: 2.6 },
  // The Moon's orbit and the phase names around it; the sunlight arrows on the left.
  phasesOrbit: { top: 11.4, bottom: -11.8, halfWidth: 13.5 },
  // Earth, its shadow, and the Moon's orbit seen edge-on.
  phasesShadow: { top: 4.5, bottom: -5.5, halfWidth: 16 },
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

  // A view from the ground passes its shot; it never backs off, as its eye is the observer.
  frame(kind: ChapterKind, groundShot?: GroundShot | null): void {
    this.applyPreset(groundShot ? groundPreset(groundShot) : this.presetFor(kind))
    // Lessons ignore the explore view's scale: the lineup is at true scale (the Sun's radius there is
    // ~0.09 units), so its zoom floor and near plane come from its own framing distance; the seasons,
    // eclipse and phases scenes are drawn at Compact sizes.
    this.lens.setLessonZoomFloor(kind === 'sizes' ? this.orbit.radius * 0.01 : COMPACT_MIN_ORBIT_RADIUS)
    if (groundShot) this.fitAbovePanel(groundBounds(groundShot), 1)
    else this.fitAbovePanel(CONTENT_BOUNDS[kind] ?? CONTENT_BOUNDS.staged!, MAX_ZOOM_OUT[kind] ?? FIT_MAX_ZOOM_OUT)
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

  private presetFor(kind: ChapterKind): CameraPreset {
    return kind === 'sizes' ? this.sizesPreset() : (FIXED_PRESETS[kind] ?? STAGED_PRESET)
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
  // the band or too wide for the screen - never moving it closer than the preset, and at most
  // maxZoomOut times farther.
  private fitAbovePanel(content: ContentBounds, maxZoomOut: number): void {
    const height = this.canvas.clientHeight
    if (height <= 0) return
    const panelTop = Math.max(LESSON_PANEL_MIN_TOP_PX, height - LESSON_PANEL_RESERVED_PX) / height
    const band = { top: FIT_MARGIN_TOP, bottom: Math.max(panelTop - FIT_MARGIN_BOTTOM, FIT_MIN_BAND_BOTTOM) }
    const tanHalfFov = Math.tan(VERTICAL_FOV_RADIANS / 2)
    const halfHeightToFit = Math.max(
      (content.top - content.bottom) / (2 * (band.bottom - band.top)),
      content.halfWidth / (this.canvas.clientWidth / height),
    )
    const presetRadius = this.orbit.radius
    this.orbit.radius = Math.min(Math.max(presetRadius, halfHeightToFit / tanHalfFov), presetRadius * maxZoomOut)
    // A point y above the target lands at screen fraction 0.5 - y / (2 * halfHeight) - shift / 2
    // from the top; solve for the shift that puts the content's middle in the band's middle.
    const halfHeight = this.orbit.radius * tanHalfFov
    this.lens.lensShiftNdc = 1 - (band.top + band.bottom) - (content.top + content.bottom) / 2 / halfHeight
  }
}
