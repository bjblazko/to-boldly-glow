import { CameraDirector } from '../camera/cameraDirector'
import { CameraLens } from '../camera/cameraLens'
import { pickTarget, type PickTarget } from '../camera/entityPicking'
import type { Obstacle } from '../camera/input/flightSpeed'
import type { Viewpoint } from '../camera/viewpoint'
import { CameraControls } from '../hud/cameraControls'
import { CameraHint } from '../hud/cameraHint'
import type { DisplaySettings } from '../hud/displaySettings'
import { ScaleModeSwitch } from '../hud/scaleModeSwitch'
import { initShuttleVisual } from '../hud/shuttleVisual'
import { TouchFlightPad } from '../hud/touchFlightPad'
import { BodyLabels } from '../labels/bodyLabels'
import type { Vec3 } from '../math/tuples'
import type { OrbitPaths } from '../orbitPaths/orbitPaths'
import type { SceneLayout } from '../scene/sceneLayout'
import { EntityFinder } from '../search/entityFinder'
import { heliocentricPosition } from '../smallBodies/keplerOrbit'
import { SMALL_BODIES } from '../smallBodies/smallBodyCatalog'
import { ALL_ENTITIES, type SolarSystemEntity } from '../solarSystem/entities'
import { scaledPosition } from '../solarSystem/sceneScale'
import { ephemerisAt, type Ephemeris } from '../time/ephemeris'
import { SimulationClock, TIME_SCALE_PRESETS } from '../time/simulationClock'
import { TimeControlUI } from '../time/timeControlUI'
import { requireElement } from './dom'

// What the last frame showed, for picking bodies by clicking on them.
export interface ShownFrame {
  layout: SceneLayout
  viewpoint: Viewpoint
  smallBodies: { id: string; position: Vec3 }[]
}

interface SimulationMoment {
  ephemeris: Ephemeris
  scaleBlend: number
}

// The interactive explorer around the scene: scale switch, clock, camera and its controls, search.
export function createExplorer(canvas: HTMLCanvasElement, display: DisplaySettings, orbitPaths: OrbitPaths) {
  const scaleMode = new ScaleModeSwitch(canvas, {
    realistic: requireElement('#scale-mode-realistic-btn'),
    compact: requireElement('#scale-mode-compact-btn'),
  })
  const clock = new SimulationClock()
  const now = (): SimulationMoment => ({ ephemeris: ephemerisAt(clock.getCurrentDate()), scaleBlend: scaleMode.blend })
  const shown: { frame: ShownFrame | null } = { frame: null }
  const select = (entity: SolarSystemEntity) => selectEntity(entity, camera, display, now())
  const camera = createCamera(canvas, {
    startTour: () => startTour(camera, clock, now),
    pick: (x, y) => pickAt({ canvas, frame: shown.frame }, x, y, select),
    following: (entity) => searchUi.setFollowing(entity),
  })
  const searchUi = createEntitySearch(camera, select)
  const lens = new CameraLens(camera.orbit, canvas)
  lens.applyZoomFloor(scaleMode.blend)
  const bodyLabels = new BodyLabels(requireElement('#body-labels'))
  return { canvas, display, scaleMode, camera, lens, clock, timeControls: createTimeControls(clock), bodyLabels, orbitPaths, searchUi, shown, select }
}

interface CameraWiring {
  startTour(): void
  pick(x: number, y: number): void
  following(entity: SolarSystemEntity | null): void
}

// The camera with its panel buttons, the steering hint, and the touch-screen flight pad.
function createCamera(canvas: HTMLCanvasElement, wiring: CameraWiring): CameraDirector {
  const touch = TouchFlightPad.wanted()
  const hint = new CameraHint(requireElement('#camera-hint'), touch)
  const pad = new TouchFlightPad({
    pad: requireElement('#touch-flight-pad'),
    stick: requireElement('#touch-flight-stick'),
    knob: requireElement('#touch-flight-knob'),
    up: requireElement('#touch-flight-up'),
    down: requireElement('#touch-flight-down'),
    boost: requireElement('#touch-flight-boost'),
  })
  const controls = new CameraControls(
    { canvas, modeButton: document.querySelector('#camera-mode-toggle'), tourButton: document.querySelector('#camera-tour-toggle') },
    () => wiring.startTour(),
  )
  const camera = new CameraDirector(canvas, {
    onModeChange: (mode) => {
      controls.showMode(mode)
      hint.showMode(mode)
      pad.setVisible(mode === 'fly' && touch)
    },
    onTourChange: (touring) => controls.showTour(touring),
    onFollowChange: (entity) => {
      if (entity) canvas.dataset.followingId = entity.id
      else delete canvas.dataset.followingId
      wiring.following(entity)
    },
    onPick: (x, y) => wiring.pick(x, y),
    onSpeedLevelChange: (level) => hint.showSpeedLevel(level),
  })
  camera.setTouchFlightCommand(() => pad.command())
  controls.bind(camera)
  hint.showMode('orbit')
  return camera
}

// Flies to the entity and follows it - showing the comets or the asteroids first, if the body is
// one of those and they are switched off.
function selectEntity(entity: SolarSystemEntity, camera: CameraDirector, display: DisplaySettings, moment: SimulationMoment): void {
  if (entity.kind === 'comet') display.comets.set(true)
  if (entity.kind === 'dwarfPlanet' || entity.kind === 'asteroid') display.asteroids.set(true)
  camera.followEntity(entity, moment.ephemeris, moment.scaleBlend)
}

// A double click or double tap on a body flies there, as picking it in the search does.
function pickAt({ canvas, frame }: { canvas: HTMLCanvasElement; frame: ShownFrame | null }, x: number, y: number, select: (entity: SolarSystemEntity) => void): void {
  if (!frame) return
  const bounds = canvas.getBoundingClientRect()
  const id = pickTarget({ x: x - bounds.left, y: y - bounds.top }, pickTargets(frame), frame.viewpoint)
  const entity = id ? ALL_ENTITIES.find((candidate) => candidate.id === id) : undefined
  if (entity) select(entity)
}

function pickTargets({ layout, smallBodies }: ShownFrame): PickTarget[] {
  return [
    { id: 'sun', position: layout.sun.position, radius: layout.sun.radius },
    ...[...layout.planets, ...layout.moons].map((pose) => ({ id: pose.definition.id, position: pose.position, radius: pose.radius })),
    ...smallBodies.map((body) => ({ ...body, radius: 0 })),
  ]
}

// The Sun, planets and moons as free flight sees them: things to slow down near and not fly into.
export function obstaclesIn(layout: SceneLayout): Obstacle[] {
  return [layout.sun, ...layout.planets, ...layout.moons].map((pose) => ({ position: pose.position, radius: pose.radius }))
}

// Where the comets and minor planets are, if they are shown (for their labels and picking).
export function shownSmallBodies(display: DisplaySettings, ephemeris: Ephemeris, scaleBlend: number): { id: string; position: Vec3 }[] {
  return SMALL_BODIES.filter((body) => (body.kind === 'comet' ? display.comets.on : display.asteroids.on)).map((body) => ({
    id: body.id,
    position: scaledPosition(heliocentricPosition(body.orbit, ephemeris.daysSinceEpoch), scaleBlend),
  }))
}

// A paused or real-time clock shows no visible spin or moon motion during a flyby, so the tour
// speeds it up to 1 hr/s - unless the user already picked a rate of their own.
function startTour(camera: CameraDirector, clock: SimulationClock, now: () => SimulationMoment): void {
  if (camera.isTouring) return
  if (clock.isPaused() || clock.getTimeScale() === 1) {
    clock.play()
    clock.setTimeScale(TIME_SCALE_PRESETS[2].secondsPerSecond)
  }
  const { ephemeris, scaleBlend } = now()
  camera.startTour(ephemeris, scaleBlend)
}

function createEntitySearch(camera: CameraDirector, select: (entity: SolarSystemEntity) => void): EntityFinder {
  return new EntityFinder(
    {
      input: requireElement('#entity-search-input'),
      tree: requireElement('#entity-tree'),
      followIndicator: requireElement('#follow-indicator'),
      followLabel: requireElement('#follow-indicator-label'),
      stopButton: requireElement('#follow-stop-button'),
    },
    { onSelect: select, onStop: () => camera.stopFollowing() },
  )
}

function createTimeControls(clock: SimulationClock): TimeControlUI {
  const shuttleSlider = requireElement<HTMLInputElement>('#time-shuttle')
  initShuttleVisual(shuttleSlider, requireElement('#time-shuttle-fill'))
  return new TimeControlUI(clock, {
    playPauseButton: requireElement('#time-play-pause'),
    reverseButton: requireElement('#time-reverse'),
    presetSelect: requireElement('#time-preset-select'),
    shuttleSlider,
    dateDisplay: requireElement('#time-display'),
  })
}
