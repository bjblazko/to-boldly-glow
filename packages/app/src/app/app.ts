import { BodyRenderer } from '../bodies/bodyRenderer'
import { CameraDirector } from '../camera/cameraDirector'
import { CameraLens } from '../camera/cameraLens'
import { createViewpoint } from '../camera/viewpoint'
import { AtmosphereShells } from '../atmosphereShell/atmosphereShell'
import { fitCanvasToDisplaySize, watchCanvasSize } from '../gpu/canvasSize'
import { initWebGpu, onDeviceLost, type GpuContext } from '../gpu/device'
import { TextureLoader } from '../gpu/textureLoader'
import { CameraControls } from '../hud/cameraControls'
import { DisplaySettings } from '../hud/displaySettings'
import { DockUI } from '../hud/dockUI'
import { ScaleModeSwitch } from '../hud/scaleModeSwitch'
import { initShuttleVisual } from '../hud/shuttleVisual'
import { BodyLabels } from '../labels/bodyLabels'
import { LearnModeController } from '../learn/learnModeController'
import { LessonCamera } from '../learn/lessonCamera'
import { LessonPanel } from '../learn/lessonPanel'
import { LessonSession } from '../learn/lessonSession'
import { SeasonsLabels } from '../learn/seasons/seasonsLabels'
import { LensFlare } from '../lensFlare/lensFlare'
import { createLinePipeline } from '../lines/lineStrip'
import { OrbitPaths } from '../orbitPaths/orbitPaths'
import { SaturnRing } from '../saturnRing/saturnRing'
import { exploreLayout } from '../scene/exploreLayout'
import { SceneRenderer, type SceneParts } from '../scene/sceneRenderer'
import { SceneTargets } from '../scene/sceneTargets'
import { EntitySearchUI } from '../search/entitySearchUI'
import { Starfield } from '../starfield/starfield'
import { ephemerisAt, type Ephemeris } from '../time/ephemeris'
import { SimulationClock, TIME_SCALE_PRESETS } from '../time/simulationClock'
import { TimeControlUI } from '../time/timeControlUI'
import { requireElement } from './dom'
import { showDeviceLost } from './errorMessages'
import { runFrameLoop, type FrameTime } from './frameLoop'

type SceneFeatures = Omit<SceneParts, 'lessons'>

// Everything the frame loop drives.
interface Explorer {
  canvas: HTMLCanvasElement
  display: DisplaySettings
  scaleMode: ScaleModeSwitch
  camera: CameraDirector
  lens: CameraLens
  clock: SimulationClock
  timeControls: TimeControlUI
  bodyLabels: BodyLabels
  lessons: LessonSession
  orbitPaths: OrbitPaths
  renderer: SceneRenderer
}

export async function startApp(canvas: HTMLCanvasElement): Promise<void> {
  fitCanvasToDisplaySize(canvas)
  const gpu = await initWebGpu(canvas)
  onDeviceLost(gpu.device, showDeviceLost)
  const { targets, linePipeline, features } = await createRendering(gpu, canvas)
  const display = new DisplaySettings(canvas, (selector) => requireElement<HTMLInputElement>(selector))
  const explorer = createExplorer(canvas, display, features)
  const lessons = createLessons(explorer, { device: gpu.device, linePipeline })
  const renderer = new SceneRenderer(gpu.device, targets, { ...features, lessons }, { display, linePipeline })
  watchCanvasSize(canvas, () => {
    targets.resize()
    lessons.reframe()
  })
  const app: Explorer = { ...explorer, lessons, renderer }
  runFrameLoop((time) => renderFrame(app, time))
}

// The scene's GPU side, its load state mirrored onto the canvas for tests to wait on.
async function createRendering(gpu: GpuContext, canvas: HTMLCanvasElement) {
  const targets = await SceneTargets.create(gpu, canvas)
  canvas.dataset.bloomSupported = String(targets.bloomSupported)
  const linePipeline = await createLinePipeline(gpu.device, targets.sceneFormat)
  const features = await createSceneFeatures(gpu.device, targets.sceneFormat, linePipeline)
  canvas.dataset.texturesLoaded = 'true'
  canvas.dataset.starCount = String(features.starfield.starCount)
  return { targets, linePipeline, features }
}

async function createSceneFeatures(device: GPUDevice, format: GPUTextureFormat, linePipeline: GPURenderPipeline): Promise<SceneFeatures> {
  const textures = await TextureLoader.create(device)
  const bodies = await BodyRenderer.create(device, format, textures)
  const [starfield, saturnRing, atmosphereShells, lensFlare] = await Promise.all([
    Starfield.create(device, format),
    SaturnRing.create(device, format, textures),
    AtmosphereShells.create(device, format, bodies.sphereMesh),
    LensFlare.create(device, format),
  ])
  return { starfield, bodies, saturnRing, atmosphereShells, lensFlare, orbitPaths: OrbitPaths.create(device, linePipeline, 1) }
}

function createExplorer(canvas: HTMLCanvasElement, display: DisplaySettings, features: SceneFeatures) {
  const scaleMode = new ScaleModeSwitch(canvas, {
    realistic: requireElement('#scale-mode-realistic-btn'),
    compact: requireElement('#scale-mode-compact-btn'),
  })
  const clock = new SimulationClock()
  const now = (): SimulationMoment => ({ ephemeris: ephemerisAt(clock.getCurrentDate()), scaleBlend: scaleMode.blend })
  const controls = new CameraControls(
    { canvas, modeButton: document.querySelector('#camera-mode-toggle'), tourButton: document.querySelector('#camera-tour-toggle') },
    () => startTour(camera, clock, now),
  )
  const camera = new CameraDirector(canvas, {
    onModeChange: (mode) => controls.showMode(mode),
    onTourChange: (touring) => controls.showTour(touring),
    onFollowChange: (entity) => {
      if (entity) canvas.dataset.followingId = entity.id
      else delete canvas.dataset.followingId
      searchUi.setFollowing(entity)
    },
  })
  const searchUi = createEntitySearch(camera, now)
  controls.bind(camera)
  const lens = new CameraLens(camera.orbit, canvas)
  lens.applyZoomFloor(scaleMode.blend)
  const bodyLabels = new BodyLabels(requireElement('#body-labels'))
  return { canvas, display, scaleMode, camera, lens, clock, timeControls: createTimeControls(clock), bodyLabels, orbitPaths: features.orbitPaths, searchUi }
}

interface SimulationMoment {
  ephemeris: Ephemeris
  scaleBlend: number
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

// Picking a result flies the orbit camera there and follows the body.
function createEntitySearch(camera: CameraDirector, now: () => SimulationMoment): EntitySearchUI {
  return new EntitySearchUI(
    {
      input: requireElement('#entity-search-input'),
      results: requireElement('#entity-search-results'),
      followIndicator: requireElement('#follow-indicator'),
      followLabel: requireElement('#follow-indicator-label'),
      stopButton: requireElement('#follow-stop-button'),
    },
    {
      onSelect: (entity) => camera.followEntity(entity, now().ephemeris, now().scaleBlend),
      onStop: () => camera.stopFollowing(),
    },
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

function createLessons(
  explorer: ReturnType<typeof createExplorer>,
  gpu: { device: GPUDevice; linePipeline: GPURenderPipeline },
): LessonSession {
  const { camera, lens, canvas, display, searchUi } = explorer
  const dock = new DockUI(
    document.querySelectorAll<HTMLButtonElement>('.hud-dock-btn:not(#learn-mode-btn)'),
    requireElement('#hud-sheet'),
    document.querySelectorAll<HTMLElement>('.hud-sheet-panel'),
  )
  const modeController = new LearnModeController(document.body, { setEnabled: (on) => camera.setInputEnabled(on) }, dock, searchUi)
  return new LessonSession(
    {
      modeController,
      camera,
      lessonCamera: new LessonCamera(camera.orbit, lens, canvas),
      display,
      panel: new LessonPanel(requireElement),
      labels: new SeasonsLabels(requireElement),
    },
    { learnButton: requireElement('#learn-mode-btn'), picker: requireElement('#lesson-picker') },
    gpu,
  )
}

function renderFrame(app: Explorer, time: FrameTime): void {
  const { canvas, display, scaleMode, camera, lens, clock, lessons } = app
  lessons.update(time.deltaSeconds)
  // Orbit paths and the zoom floor (and with it the near plane) follow the scale transition.
  if (scaleMode.update(time.deltaSeconds)) {
    app.orbitPaths.rescale(scaleMode.blend)
    lens.applyZoomFloor(scaleMode.blend)
  }
  camera.steer(time.deltaSeconds)
  clock.update(time.realDeltaSeconds)
  app.timeControls.refreshDisplay()
  const ephemeris = ephemerisAt(clock.getCurrentDate())
  // Follow and tour move the camera to this frame's positions before the view is taken.
  camera.update(time.deltaSeconds, ephemeris, scaleMode.blend)
  const viewpoint = createViewpoint(camera.viewMatrix(), lens.projection(), canvas)
  const layout = lessons.layout(ephemeris) ?? exploreLayout(ephemeris, scaleMode.blend, display.moons.on)
  app.bodyLabels.update(layout, viewpoint, display.bodyLabels.on)
  app.renderer.render({ layout, viewpoint, nowSeconds: time.nowSeconds })
  canvas.dataset.rendered = 'true'
}
