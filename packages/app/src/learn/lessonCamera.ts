import { vec3 } from 'gl-matrix'
import { EasedTween } from '../math/easedTween'
import { COMPACT_MIN_ORBIT_RADIUS, WALK_RADIUS, type OrbitCamera } from '../camera/orbitCamera'
import { aimedAt, blendViews, cameraSnapshot, keepOutside, viewAbout, type CameraView, type KeepOut, type Snapshot } from './lessonCameraViews'
import { entryFrom, poseOf, WalkFlight, type Entry } from './walkFlight'
import { circleSpot, walkInto, walkUpTo, type Obstacle } from './cabinWalk'
import type { CameraLens } from '../camera/cameraLens'
import { NO_LENS_SHIFT, VERTICAL_FOV_RADIANS } from '../camera/viewpoint'
import { ECLIPTIC_NORTH } from '../solarSystem/poleOrientation'
import type { Vec3 } from '../math/tuples'
import { RING_OUTER_RADIUS_FACTOR } from '../saturnRing/ringMesh'
import { EARTH_POSITION } from './eclipse/eclipseGeometry'
import { PHASES_EARTH_POSITION } from './phases/phasesGeometry'
import { groundBounds, groundPreset } from './ground/groundFraming'
import type { GroundShot } from './ground/groundShot'
import type { Chapter } from './lessonTypes'
import { fitToRegion, sceneRegion } from './lessonFrame'
import { lookAroundLimits, panLimitFor, ViewWatch, type ViewState } from './lookAround'
import type { CameraPreset, ContentBounds, LessonShot } from './lessonShot'
import { EARTH_STAGED_POSITION } from './seasons/seasonsScene'
import { LINEUP_PLANETS_EXTENT, LINEUP_SUN_RADIUS, lineupSlot } from './sizes/sizesLineup'

type ChapterKind = Chapter['kind']


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
export const GLIDE_SECONDS = 1.6

const FIT_MAX_ZOOM_OUT = 2

// How far the user may zoom around a scene from where the chapter frames it (see lookAround.ts for
// turning and moving): in to 30% of the framing distance (never past the scene's own zoom floor;
// a model, to that floor) and back off to twice it.
const ZOOM_IN_LIMIT = 0.3
const ZOOM_OUT_LIMIT = 2


// How far a lineup planet reaches from its center (for Saturn, its rings), plus the room around it.
function focusReach(planetId: string): number {
  const { radius } = lineupSlot(planetId)
  if (planetId !== 'saturn') return radius * FOCUS_MARGIN
  return Math.max(radius * FOCUS_MARGIN, radius * RING_OUTER_RADIUS_FACTOR * FOCUS_RING_MARGIN)
}

// Turned toward the Sun (at the origin) by up to FOCUS_SUNWARD_RADIANS, but no further than keeps a
// camera `distance` from the planet FOCUS_SUN_CLEARANCE_RADII from the Sun's center: with the
// planet `x` from the Sun, the camera is sqrt(distance² + x² - 2·distance·|x|·sin(turn)) from it.
function focusAzimuth(planetId: string, lineupOrder: readonly string[] | undefined, distance: number): number {
  const fromSun = Math.abs(lineupSlot(planetId, lineupOrder).x)
  const clearance = FOCUS_SUN_CLEARANCE_RADII * LINEUP_SUN_RADIUS
  const sinTurn = (distance * distance + fromSun * fromSun - clearance * clearance) / (2 * distance * fromSun)
  return Math.PI / 2 - Math.min(FOCUS_SUNWARD_RADIANS, Math.asin(Math.min(1, Math.max(0, sinTurn))))
}

function focusBounds(planetId: string): ContentBounds {
  const reach = focusReach(planetId)
  return { top: reach, bottom: -reach, halfWidth: reach }
}

// Everything a shot sets on the camera, so a flight can ease between two of them.

export interface FramingOptions {
  // 'sizes' chapters: the planet to close in on (see Chapter.focusPlanetId).
  focusPlanetId?: string
  // 'sizes' chapters: the order the planets stand in (out from the Sun if not given).
  lineupOrder?: readonly string[]
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
// lookAround.ts); framing again (a new kind, or the reset button) brings the shot back.
export class LessonCamera {
  // The orbit camera's own zoom-out limit, put back when the lesson ends.
  private freeMaxRadius: number | null = null
  // Likewise the orbit camera's pan limit.
  private freePanLimit: number | null = null
  private readonly watch = new ViewWatch()
  private glide: Glide | null = null
  private flight: WalkFlight | null = null
  private obstacle: Obstacle | null = null

  constructor(
    private readonly orbit: OrbitCamera,
    private readonly lens: CameraLens,
    private readonly canvas: HTMLCanvasElement,
  ) {}

  // A view from the ground passes its shot; it never backs off, as its eye is the observer.
  frame(kind: ChapterKind, groundShot?: GroundShot | null, { focusPlanetId, lineupOrder, glide = false }: FramingOptions = {}): void {
    const from = glide ? cameraSnapshot(this.orbit, this.lens.lensShift) : null
    this.orbit.walk = null
    this.flight = null
    this.lens.fov = VERTICAL_FOV_RADIANS
    this.applyPreset(groundShot ? groundPreset(groundShot) : this.presetFor(kind, focusPlanetId, lineupOrder))
    // Lessons ignore the explore view's scale: the lineup is at true scale (the Sun's radius there is
    // ~0.09 units), so its zoom floor and near plane come from its own framing distance; the seasons,
    // eclipse and phases scenes are drawn at Compact sizes.
    const sceneFloor = kind === 'sizes' ? this.orbit.radius * 0.01 : COMPACT_MIN_ORBIT_RADIUS
    this.lens.setLessonZoomFloor(sceneFloor)
    this.fitShot(kind, groundShot, { focusPlanetId, lineupOrder })
    // The observer's eye on the ground stays put (the lesson doesn't take camera input there).
    if (!groundShot) this.allowLookingAround(sceneFloor, { bounds: this.boundsFor(kind, groundShot, focusPlanetId) })
    this.watch.framedAt(this.viewState())
    this.glide = from ? this.startGlide(from) : null
  }

  // A staged scene's own shot for a chapter (see LessonShot), or a flight there (glide).
  frameShot(shot: LessonShot, glide = false): void {
    const from = glide ? cameraSnapshot(this.orbit, this.lens.lensShift) : null
    const entry = glide ? entryFrom(this.orbit, shot.walk?.through) : null
    this.lens.fov = shot.fov ?? VERTICAL_FOV_RADIANS
    this.applyPreset(shot.preset)
    const sceneFloor = shot.zoomFloor ?? COMPACT_MIN_ORBIT_RADIUS
    this.lens.setLessonZoomFloor(sceneFloor)
    this.fitAbovePanel(shot.bounds, shot.maxZoomOut)
    this.allowLookingAround(sceneFloor, shot)
    this.enterRoom(shot, sceneFloor)
    this.watch.framedAt(this.viewState())
    this.setOff(from, entry)
  }

  // Flies to the shot just framed: into a room along its path, else by the usual glide.
  private setOff(from: Snapshot | null, entry: Entry | null): void {
    this.glide = null
    this.flight = null
    if (entry) {
      this.flight = new WalkFlight(entry.from, entry.through, poseOf(this.orbit))
      this.flight.update(0, this.orbit)
    } else if (from) this.glide = this.startGlide(from)
  }

  // A shot one walks through: the camera turns walking, its near plane close enough for a room.
  private enterRoom(shot: LessonShot, sceneFloor: number): void {
    if (walkInto(this.orbit, shot, this.obstacle)) this.lens.setLessonZoomFloor(Math.min(sceneFloor, WALK_RADIUS))
  }

  private fitShot(kind: ChapterKind, groundShot: GroundShot | null | undefined, { focusPlanetId, lineupOrder }: FramingOptions): void {
    if (groundShot) this.fitAbovePanel(groundBounds(groundShot), 1)
    else if (kind === 'sizes' && focusPlanetId) {
      this.fitAbovePanel(focusBounds(focusPlanetId), FOCUS_MAX_ZOOM_OUT)
      // How far it may turn toward the Sun depends on how far back the fit put it.
      this.orbit.azimuth = focusAzimuth(focusPlanetId, lineupOrder, this.orbit.radius)
    } else this.fitAbovePanel(CONTENT_BOUNDS[kind] ?? CONTENT_BOUNDS.staged!, MAX_ZOOM_OUT[kind] ?? FIT_MAX_ZOOM_OUT)
  }

  // Moves a flight between two shots along (see frame's glide option).
  // `keepOut`: balls the flight passes over, not through (the staged scene's planets).
  update(deltaSeconds: number, keepOut: readonly KeepOut[] = []): void {
    if (this.flight && !this.flight.update(deltaSeconds, this.orbit)) this.flight = null
    const glide = this.glide
    if (!glide) return
    // While under way: a step further along (the last one reaches the end), kept clear of the balls.
    this.showView(glide.progress.isAnimating ? keepOutside(blendViews(glide.from, glide.to, glide.progress.update(deltaSeconds)), this.orbit.upAxis, keepOut) : glide.to)
    if (glide.progress.isAnimating) return
    this.glide = null
    this.lens.setLessonZoomFloor(glide.zoomFloor)
  }

  // Keeps looking at a moving point (a craft lifting off) from where the camera stands - turning
  // after it, as a camera on the ground would; a flight under way ends looking at it.
  follow(point: Vec3): void {
    if (this.glide) this.glide.to = aimedAt(this.glide.to, point, this.orbit.upAxis)
    else this.showView(aimedAt(this.currentView(), point, this.orbit.upAxis))
  }

  // Whether the camera is still on its way to the shot.
  get isGliding(): boolean {
    return this.glide !== null || this.flight !== null
  }

  // What stops the camera walking through a staged room (see LessonShot.walk); null: nothing to walk in.
  setObstacle(obstacle: Obstacle | null): void {
    this.obstacle = obstacle
  }

  release(): void {
    this.glide = null
    this.flight = null
    this.orbit.walk = null
    this.orbit.viewLimits = null
    if (this.freeMaxRadius !== null) this.orbit.maxRadius = this.freeMaxRadius
    this.freeMaxRadius = null
    if (this.freePanLimit !== null) this.orbit.panLimit = this.freePanLimit
    this.freePanLimit = null
    this.lens.setLessonZoomFloor(null)
    this.lens.lensShift = NO_LENS_SHIFT
    this.lens.fov = VERTICAL_FOV_RADIANS
    this.orbit.radius = Math.max(this.orbit.radius, this.orbit.minRadius)
  }

  // Whether the user has moved the view since the shot was framed (see ViewWatch).
  get viewLeft(): boolean {
    return this.watch.hasLeft(this.viewState(), this.isGliding)
  }

  private viewState(): ViewState {
    const { radius, azimuth, elevation } = this.orbit
    return { pivot: this.orbit.pivot(), radius, azimuth, elevation }
  }

  private allowLookingAround(sceneFloor: number, { bounds, freeLook = false, panReach }: Pick<LessonShot, 'bounds' | 'freeLook' | 'panReach'>): void {
    const { azimuth, elevation, radius } = this.orbit
    this.freeMaxRadius ??= this.orbit.maxRadius
    this.freePanLimit ??= this.orbit.panLimit
    this.orbit.viewLimits = lookAroundLimits(azimuth, elevation, freeLook)
    this.orbit.maxRadius = radius * ZOOM_OUT_LIMIT
    this.orbit.panLimit = panReach ?? panLimitFor(bounds)
    this.lens.setLessonZoomFloor(freeLook ? sceneFloor : Math.max(sceneFloor, radius * ZOOM_IN_LIMIT))
  }

  // What the chapter's shot must show, as fitShot fits it.
  private boundsFor(kind: ChapterKind, groundShot: GroundShot | null | undefined, focusPlanetId?: string): ContentBounds {
    if (groundShot) return groundBounds(groundShot)
    if (kind === 'sizes' && focusPlanetId) return focusBounds(focusPlanetId)
    return CONTENT_BOUNDS[kind] ?? CONTENT_BOUNDS.staged!
  }

  private applyPreset(preset: CameraPreset): void {
    this.orbit.clearPan()
    vec3.set(this.orbit.target, ...preset.target)
    this.orbit.radius = preset.radius
    this.orbit.azimuth = preset.azimuth
    this.orbit.elevation = preset.elevation
    vec3.set(this.orbit.upAxis, ...preset.upAxis)
  }

  // Glides to look at a point (what a double click found), from about where the camera already is:
  // the same side of the point, no farther than now - so inside a cabin it never backs out through
  // a wall.
  lookAt(point: Vec3): void {
    const from = cameraSnapshot(this.orbit, this.lens.lensShift)
    this.flight = null
    if (this.orbit.walk) walkUpTo(this.orbit, point)
    else circleSpot(this.orbit, point, from.radius)
    this.glide = this.startGlide(from)
  }

  // Starts the flight from where the camera was to the shot just framed, which becomes its end. On
  // the way, the zoom floor (and with it the near plane) stays low enough for both ends.
  private startGlide(before: Snapshot): Glide {
    const to = this.currentView()
    const from = viewAbout(before, this.orbit.upAxis)
    // The short way round, whichever turn the angles were counted from.
    from.azimuth += Math.round((to.azimuth - from.azimuth) / (2 * Math.PI)) * 2 * Math.PI
    const zoomFloor = this.orbit.minRadius
    const progress = new EasedTween(0, GLIDE_SECONDS)
    progress.retarget(1, 0)
    this.lens.setLessonZoomFloor(Math.min(zoomFloor, from.radius * ZOOM_IN_LIMIT))
    this.showView(from)
    return { from, to, progress, zoomFloor }
  }

  // Where the camera looks now: a moved pivot counts as the target.
  private currentView(): CameraView {
    const { radius, azimuth, elevation } = this.orbit
    const pivot = this.orbit.pivot()
    return { target: [pivot[0], pivot[1], pivot[2]], radius, azimuth, elevation, lensShift: this.lens.lensShift }
  }

  private showView(view: CameraView): void {
    this.orbit.clearPan()
    vec3.set(this.orbit.target, ...view.target)
    this.orbit.radius = view.radius
    this.orbit.azimuth = view.azimuth
    this.orbit.elevation = view.elevation
    this.lens.lensShift = view.lensShift
  }

  private presetFor(kind: ChapterKind, focusPlanetId?: string, lineupOrder?: readonly string[]): CameraPreset {
    if (kind !== 'sizes') return FIXED_PRESETS[kind] ?? STAGED_PRESET
    return focusPlanetId ? this.focusPreset(focusPlanetId, lineupOrder) : this.sizesPreset()
  }

  // Close up on one planet: as near as fits it on the whole screen; fitAbovePanel then backs off to
  // fit it in the band above the panel.
  private focusPreset(planetId: string, lineupOrder?: readonly string[]): CameraPreset {
    return {
      target: [lineupSlot(planetId, lineupOrder).x, 0, 0],
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

  // Fits the scene into the part of the screen the lesson panel leaves free (see lessonFrame.ts).
  private fitAbovePanel(content: ContentBounds, maxZoomOut: number): void {
    const { clientWidth: width, clientHeight: height } = this.canvas
    if (height <= 0) return
    const { radius, lensShift } = fitToRegion(content, { region: sceneRegion(width, height), aspect: width / height, fov: this.lens.fov }, this.orbit.radius, maxZoomOut)
    this.orbit.radius = radius
    this.lens.lensShift = lensShift
  }
}
