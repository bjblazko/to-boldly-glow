import { vec3 } from 'gl-matrix'
import { EasedTween } from '../math/easedTween'
import { lerp, lerpVec3 } from '../math/easing'
import { COMPACT_MIN_ORBIT_RADIUS, orbitBasisForUpAxis, type OrbitCamera } from '../camera/orbitCamera'
import type { CameraLens } from '../camera/cameraLens'
import { VERTICAL_FOV_RADIANS } from '../camera/viewpoint'
import { ECLIPTIC_NORTH } from '../solarSystem/poleOrientation'
import { pointAlong, type Vec3 } from '../math/tuples'
import { RING_OUTER_RADIUS_FACTOR } from '../saturnRing/ringMesh'
import { EARTH_POSITION } from './eclipse/eclipseGeometry'
import { PHASES_EARTH_POSITION } from './phases/phasesGeometry'
import { directionAtAltitude, lookAltitudeDegrees, type GroundShot } from './ground/groundShot'
import type { Chapter } from './lessonTypes'
import { EARTH_STAGED_POSITION } from './seasons/seasonsScene'
import { LINEUP_PLANETS_EXTENT, LINEUP_SUN_RADIUS, lineupSlot } from './sizes/sizesLineup'

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

// Sizes lineup: looking across the row (along -Y, from the side of the ecliptic) with X horizontal
// and ecliptic north up, so the planets show their equators, from just far enough to fit the
// planets' width across the screen.
const SIZES_FRAMING_MARGIN = 1.15
const SIZES_ELEVATION = 0.1

// A planet of the lineup, close up: big in the band above the lesson panel, with this much room
// around it (Saturn's rings get a little less: they are its outermost edge, and seldom seen face
// on), and seen from up to 35 degrees toward the Sun (along +X), so most of its face is lit. The
// planets nearest the Sun turn less, as the camera has to keep clear of it: Jupiter sits just past
// its surface.
const FOCUS_MARGIN = 1.35
const FOCUS_RING_MARGIN = 1.08
const FOCUS_SUNWARD_RADIANS = 0.6
const FOCUS_SUN_CLEARANCE_RADII = 1.5
const FOCUS_MAX_ZOOM_OUT = 4

// Moving from one sizes chapter to the next flies the camera there, rather than cutting.
const GLIDE_SECONDS = 1.6

// The lesson panel covers the canvas's bottom; its top rises at most to max(16px, 100% - 376px)
// (see .hud-lesson-panel in hud.css) - keep the two in sync.
const LESSON_PANEL_RESERVED_PX = 376
const LESSON_PANEL_MIN_TOP_PX = 16
// The top bar (the Explore / Learn switch) covers the canvas's top 76px.
const TOP_BAR_RESERVED_PX = 76
const FIT_MARGIN_TOP = 0.05
const FIT_MARGIN_BOTTOM = 0.04
// On short windows the panel covers most of the screen; the scene still gets at least the top half
// (the panel can be dragged aside), and the camera backs off at most this far from the preset.
const FIT_MIN_BAND_BOTTOM = 0.5
// Nor does the top bar squeeze the scene below this share of the screen: on short windows the
// scene reaches up beside the (narrow) mode switch instead.
const FIT_MIN_BAND_HEIGHT = 0.4
const FIT_MAX_ZOOM_OUT = 2

// How far the user may look around a scene from where the chapter frames it: turn the view by up to
// 30 degrees either way, zoom in to 30% of the framing distance (never past the scene's own zoom
// floor) and back off to twice it.
const LOOK_AROUND_RADIANS = Math.PI / 6
const ZOOM_IN_LIMIT = 0.3
const ZOOM_OUT_LIMIT = 2

interface ContentBounds {
  top: number
  bottom: number
  halfWidth: number
}

// How far a lineup planet reaches from its center (for Saturn, its rings), plus the room around it.
function focusReach(planetId: string): number {
  const { radius } = lineupSlot(planetId)
  if (planetId !== 'saturn') return radius * FOCUS_MARGIN
  return Math.max(radius * FOCUS_MARGIN, radius * RING_OUTER_RADIUS_FACTOR * FOCUS_RING_MARGIN)
}

// Turned toward the Sun (at the origin) by up to FOCUS_SUNWARD_RADIANS, but no further than keeps a
// camera `distance` from the planet FOCUS_SUN_CLEARANCE_RADII from the Sun's center: with the
// planet `x` from the Sun, the camera is sqrt(distance² + x² - 2·distance·|x|·sin(turn)) from it.
function focusAzimuth(planetId: string, distance: number): number {
  const fromSun = Math.abs(lineupSlot(planetId).x)
  const clearance = FOCUS_SUN_CLEARANCE_RADII * LINEUP_SUN_RADIUS
  const sinTurn = (distance * distance + fromSun * fromSun - clearance * clearance) / (2 * distance * fromSun)
  return Math.PI / 2 - Math.min(FOCUS_SUNWARD_RADIANS, Math.asin(Math.min(1, Math.max(0, sinTurn))))
}

function focusBounds(planetId: string): ContentBounds {
  const reach = focusReach(planetId)
  return { top: reach, bottom: -reach, halfWidth: reach }
}

// Everything a shot sets on the camera, so a flight can ease between two of them.
interface CameraView {
  target: Vec3
  radius: number
  azimuth: number
  elevation: number
  lensShiftNdc: number
}

// The target and angles ease along evenly; the distance by the same factor each step, so a flight
// from the whole lineup down to little Mercury doesn't rush through the close-up end.
function blendViews(from: CameraView, to: CameraView, t: number): CameraView {
  return {
    target: lerpVec3(from.target, to.target, t),
    radius: Math.exp(lerp(Math.log(from.radius), Math.log(to.radius), t)),
    azimuth: lerp(from.azimuth, to.azimuth, t),
    elevation: lerp(from.elevation, to.elevation, t),
    lensShiftNdc: lerp(from.lensShiftNdc, to.lensShiftNdc, t),
  }
}

export interface FramingOptions {
  // 'sizes' chapters: the planet to close in on (see Chapter.focusPlanetId).
  focusPlanetId?: string
  // Fly there from the current view instead of cutting to the shot.
  glide?: boolean
}

interface Glide {
  from: CameraView
  to: CameraView
  progress: EasedTween
  // The shot's own zoom floor, set once the camera has arrived.
  zoomFloor: number
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
// scene animates; only the sizes lesson's planets each have a close-up of their own, and the camera
// flies from one to the next. From there the user may look around a little (see
// LOOK_AROUND_RADIANS); framing again (a new kind, or the reset button) brings the shot back.
export class LessonCamera {
  // The orbit camera's own zoom-out limit, put back when the lesson ends.
  private freeMaxRadius: number | null = null
  private glide: Glide | null = null

  constructor(
    private readonly orbit: OrbitCamera,
    private readonly lens: CameraLens,
    private readonly canvas: HTMLCanvasElement,
  ) {}

  // A view from the ground passes its shot; it never backs off, as its eye is the observer.
  frame(kind: ChapterKind, groundShot?: GroundShot | null, { focusPlanetId, glide = false }: FramingOptions = {}): void {
    const from = glide ? this.currentView() : null
    this.applyPreset(groundShot ? groundPreset(groundShot) : this.presetFor(kind, focusPlanetId))
    // Lessons ignore the explore view's scale: the lineup is at true scale (the Sun's radius there is
    // ~0.09 units), so its zoom floor and near plane come from its own framing distance; the seasons,
    // eclipse and phases scenes are drawn at Compact sizes.
    const sceneFloor = kind === 'sizes' ? this.orbit.radius * 0.01 : COMPACT_MIN_ORBIT_RADIUS
    this.lens.setLessonZoomFloor(sceneFloor)
    this.fitShot(kind, groundShot, focusPlanetId)
    // The observer's eye on the ground stays put (the lesson doesn't take camera input there).
    if (!groundShot) this.allowLookingAround(sceneFloor)
    this.glide = from ? this.startGlide(from) : null
  }

  private fitShot(kind: ChapterKind, groundShot: GroundShot | null | undefined, focusPlanetId: string | undefined): void {
    if (groundShot) this.fitAbovePanel(groundBounds(groundShot), 1)
    else if (kind === 'sizes' && focusPlanetId) {
      this.fitAbovePanel(focusBounds(focusPlanetId), FOCUS_MAX_ZOOM_OUT)
      // How far it may turn toward the Sun depends on how far back the fit put it.
      this.orbit.azimuth = focusAzimuth(focusPlanetId, this.orbit.radius)
    } else this.fitAbovePanel(CONTENT_BOUNDS[kind] ?? CONTENT_BOUNDS.staged!, MAX_ZOOM_OUT[kind] ?? FIT_MAX_ZOOM_OUT)
  }

  // Moves a flight between two shots along (see frame's glide option).
  update(deltaSeconds: number): void {
    const glide = this.glide
    if (!glide) return
    this.showView(blendViews(glide.from, glide.to, glide.progress.update(deltaSeconds)))
    if (glide.progress.isAnimating) return
    this.glide = null
    this.lens.setLessonZoomFloor(glide.zoomFloor)
  }

  // Whether the camera is still on its way to the shot.
  get isGliding(): boolean {
    return this.glide !== null
  }

  release(): void {
    this.glide = null
    this.orbit.viewLimits = null
    if (this.freeMaxRadius !== null) this.orbit.maxRadius = this.freeMaxRadius
    this.freeMaxRadius = null
    this.lens.setLessonZoomFloor(null)
    this.lens.lensShiftNdc = 0
    this.orbit.radius = Math.max(this.orbit.radius, this.orbit.minRadius)
  }

  private allowLookingAround(sceneFloor: number): void {
    const { azimuth, elevation, radius } = this.orbit
    this.freeMaxRadius ??= this.orbit.maxRadius
    this.orbit.viewLimits = {
      azimuth: [azimuth - LOOK_AROUND_RADIANS, azimuth + LOOK_AROUND_RADIANS],
      elevation: [elevation - LOOK_AROUND_RADIANS, elevation + LOOK_AROUND_RADIANS],
    }
    this.orbit.maxRadius = radius * ZOOM_OUT_LIMIT
    this.lens.setLessonZoomFloor(Math.max(sceneFloor, radius * ZOOM_IN_LIMIT))
  }

  private applyPreset(preset: CameraPreset): void {
    vec3.set(this.orbit.target, ...preset.target)
    this.orbit.radius = preset.radius
    this.orbit.azimuth = preset.azimuth
    this.orbit.elevation = preset.elevation
    vec3.set(this.orbit.upAxis, ...preset.upAxis)
  }

  // Starts the flight from where the camera was to the shot just framed, which becomes its end. On
  // the way, the zoom floor (and with it the near plane) stays low enough for both ends.
  private startGlide(from: CameraView): Glide {
    const to = this.currentView()
    const zoomFloor = this.orbit.minRadius
    const progress = new EasedTween(0, GLIDE_SECONDS)
    progress.retarget(1, 0)
    this.lens.setLessonZoomFloor(Math.min(zoomFloor, from.radius * ZOOM_IN_LIMIT))
    this.showView(from)
    return { from, to, progress, zoomFloor }
  }

  private currentView(): CameraView {
    const { target, radius, azimuth, elevation } = this.orbit
    return { target: [target[0], target[1], target[2]], radius, azimuth, elevation, lensShiftNdc: this.lens.lensShiftNdc }
  }

  private showView(view: CameraView): void {
    vec3.set(this.orbit.target, ...view.target)
    this.orbit.radius = view.radius
    this.orbit.azimuth = view.azimuth
    this.orbit.elevation = view.elevation
    this.lens.lensShiftNdc = view.lensShiftNdc
  }

  private presetFor(kind: ChapterKind, focusPlanetId?: string): CameraPreset {
    if (kind !== 'sizes') return FIXED_PRESETS[kind] ?? STAGED_PRESET
    return focusPlanetId ? this.focusPreset(focusPlanetId) : this.sizesPreset()
  }

  // Close up on one planet: as near as fits it on the whole screen; fitAbovePanel then backs off to
  // fit it in the band above the panel.
  private focusPreset(planetId: string): CameraPreset {
    return {
      target: [lineupSlot(planetId).x, 0, 0],
      radius: focusReach(planetId) / Math.tan(VERTICAL_FOV_RADIANS / 2),
      azimuth: Math.PI / 2, // turned toward the Sun once fitted (see frame)
      elevation: SIZES_ELEVATION,
      upAxis: [...ECLIPTIC_NORTH],
    }
  }

  private sizesPreset(): CameraPreset {
    const { minX, maxX } = LINEUP_PLANETS_EXTENT
    const halfWidthPerUnitDistance = Math.tan(VERTICAL_FOV_RADIANS / 2) * (this.canvas.width / this.canvas.height)
    return {
      target: [(minX + maxX) / 2, 0, 0],
      radius: ((maxX - minX) * SIZES_FRAMING_MARGIN) / 2 / halfWidthPerUnitDistance,
      azimuth: Math.PI / 2,
      elevation: SIZES_ELEVATION,
      upAxis: [...ECLIPTIC_NORTH],
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
    const bottom = Math.max(panelTop - FIT_MARGIN_BOTTOM, FIT_MIN_BAND_BOTTOM)
    const band = { top: Math.max(FIT_MARGIN_TOP, Math.min(TOP_BAR_RESERVED_PX / height, bottom - FIT_MIN_BAND_HEIGHT)), bottom }
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
