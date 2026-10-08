import { BodyRenderer } from '../bodies/bodyRenderer'
import { createViewpoint } from '../camera/viewpoint'
import { AtmosphereShells } from '../atmosphereShell/atmosphereShell'
import { Aurora } from '../earthAurora/aurora'
import { CloudLayer } from '../earthClouds/cloudLayer'
import { fitCanvasToDisplaySize, watchCanvasSize } from '../gpu/canvasSize'
import { initWebGpu, onDeviceLost, type GpuContext } from '../gpu/device'
import { TextureLoader } from '../gpu/textureLoader'
import { DisplaySettings } from '../hud/displaySettings'
import { DockUI } from '../hud/dockUI'
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
import { SkyBackdrop } from '../sky/skyBackdrop'
import { AsteroidBelt } from '../smallBodies/asteroidBelt'
import { CometRenderer } from '../smallBodies/cometRenderer'
import { Starfield } from '../starfield/starfield'
import { SunCorona } from '../sunCorona/sunCorona'
import { ephemerisAt } from '../time/ephemeris'
import { requireElement } from './dom'
import { showDeviceLost } from './errorMessages'
import { createExplorer, obstaclesIn, shownSmallBodies, type ShownFrame } from './explorer'
import { runFrameLoop, type FrameTime } from './frameLoop'

type SceneFeatures = Omit<SceneParts, 'lessons'>

// Everything the frame loop drives.
type Explorer = ReturnType<typeof createExplorer> & { lessons: LessonSession; renderer: SceneRenderer }

export async function startApp(canvas: HTMLCanvasElement): Promise<void> {
  fitCanvasToDisplaySize(canvas)
  const gpu = await initWebGpu(canvas)
  onDeviceLost(gpu.device, showDeviceLost)
  const { targets, linePipeline, features } = await createRendering(gpu, canvas)
  const display = new DisplaySettings(canvas, (selector) => requireElement<HTMLInputElement>(selector))
  const explorer = createExplorer(canvas, display, features.orbitPaths)
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
  const [sky, starfield, corona, asteroids, comets, saturnRing, atmosphereShells, clouds, aurora, lensFlare] = await Promise.all([
    SkyBackdrop.create(device, format, textures),
    Starfield.create(device, format),
    SunCorona.create(device, format),
    AsteroidBelt.create(device, format),
    CometRenderer.create(device, format),
    SaturnRing.create(device, format, textures),
    AtmosphereShells.create(device, format, bodies.sphereMesh),
    CloudLayer.create(device, format, bodies.sphereMesh),
    Aurora.create(device, format, bodies.sphereMesh),
    LensFlare.create(device, format),
  ])
  return { sky, starfield, corona, asteroids, comets, bodies, saturnRing, atmosphereShells, clouds, aurora, lensFlare, orbitPaths: OrbitPaths.create(device, linePipeline, 1) }
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
  showFrame(app, { layout, viewpoint, smallBodies: shownSmallBodies(display, ephemeris, scaleMode.blend) })
  app.renderer.render({ layout, viewpoint, nowSeconds: time.nowSeconds, clock: { daysSinceEpoch: ephemeris.daysSinceEpoch, scaleBlend: scaleMode.blend } })
  canvas.dataset.rendered = 'true'
}

// Labels, and what free flight and picking work from in the next frame.
function showFrame(app: Explorer, frame: ShownFrame): void {
  app.bodyLabels.update(frame.layout, frame.viewpoint, app.display.bodyLabels.on, frame.smallBodies)
  app.shown.frame = frame
  app.camera.setSurroundings(obstaclesIn(frame.layout))
}
