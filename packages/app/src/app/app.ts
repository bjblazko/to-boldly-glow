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
import { FpsMeter } from '../hud/fpsMeter'
import { LearnModeController } from '../learn/learnModeController'
import { LearnUi } from '../learn/learnUi'
import { LessonCamera } from '../learn/lessonCamera'
import { LessonPanel } from '../learn/lessonPanel'
import { LessonProgress } from '../learn/lessonProgress'
import { LessonSession, type LessonGpu, type LessonVoice } from '../learn/lessonSession'
import { LessonViewControls } from '../learn/lessonViewControls'
import { EclipseLabels } from '../learn/eclipse/eclipseLabels'
import { EclipseLesson } from '../learn/eclipse/eclipseLesson'
import { GroundSky } from '../learn/ground/groundSky'
import { PhaseInset } from '../learn/phases/phaseInset'
import { PhasesLabels } from '../learn/phases/phasesLabels'
import { PhasesLesson } from '../learn/phases/phasesLesson'
import { VoyagerLabels } from '../learn/voyager/voyagerLabels'
import { SaturnVLesson } from '../learn/apollo/saturnVLesson'
import { VoyagerLesson } from '../learn/voyager/voyagerLesson'
import { createModelContext, type ModelContext } from '../spacecraft/modelRenderer'
import { ScenePlayers } from '../scene/scenePlayers'
import { ExploreSpacecraft } from '../spacecraft/exploreSpacecraft'
import { loadSpacecraftTrajectories } from '../spacecraft/spacecraftCatalog'
import { MissionNarration } from '../missions/missionNarration'
import { createMissionTours, createTours, type MissionTours } from './tours'
import { createHud } from './hudShell'
import { BarContextView } from '../hud/barContext'
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
import { ephemerisAt, type Ephemeris } from '../time/ephemeris'
import { requireElement } from './dom'
import { showDeviceLost } from './errorMessages'
import { createExplorer, obstaclesIn, shownSmallBodies, type ShownFrame } from './explorer'
import { runFrameLoop, type FrameTime } from './frameLoop'
import type { VoiceSignals } from '../narration/audioClipPlayer'
import { loadNarrationManifest, type NarrationManifest } from '../narration/narrationManifest'
import { voiceSignals, VoiceStatus } from '../narration/voiceStatus'
import { MusicEngine } from '../music/musicEngine'
import { LessonNarration } from '../narration/lessonNarration'
import { bindMusicSettings } from '../music/musicSettings'

type SceneFeatures = Omit<SceneParts, 'players'>

// Everything the frame loop drives.
type Explorer = ReturnType<typeof createExplorer> & { lessons: LessonSession; players: ScenePlayers; renderer: SceneRenderer; fps: FpsMeter; firstFrame: () => void }

export async function startApp(canvas: HTMLCanvasElement): Promise<void> {
  fitCanvasToDisplaySize(canvas)
  const gpu = await initWebGpu(canvas)
  onDeviceLost(gpu.device, showDeviceLost)
  const [{ targets, linePipeline, features, groundSky, models }, narrationManifest] = await Promise.all([createRendering(gpu, canvas), loadNarrationManifest(), loadSpacecraftTrajectories()])
  const display = new DisplaySettings(canvas, (selector) => requireElement<HTMLInputElement>(selector))
  const music = new MusicEngine()
  const voice = voiceSignals((audible) => music.duck(audible), new VoiceStatus(requireElement('#voice-status')))
  const explorer = createExplorer(canvas, display, features.orbitPaths, { narrationManifest, voice })
  const { lessons, players, firstFrame } = createPlayers(explorer, { device: gpu.device, linePipeline, models }, groundSky, { narrationManifest, voice })
  bindMusicSettings(requireElement('#music-switch'), requireElement<HTMLInputElement>('#music-volume'), music)
  const renderer = new SceneRenderer(gpu.device, targets, { ...features, players }, { display, linePipeline })
  watchCanvasSize(canvas, () => {
    targets.resize()
    lessons.reframe()
  })
  const fps = new FpsMeter(requireElement('#fps-display'), () => display.fps.on)
  const app: Explorer = { ...explorer, lessons, players, renderer, fps, firstFrame }
  runFrameLoop((time) => renderFrame(app, time))
}

// Who stages a scene of their own: the lessons and the mission tours - each with its narrator, the
// music stepping back while one speaks - and the spacecraft drawn into the explore view.
function createPlayers(explorer: ReturnType<typeof createExplorer>, gpu: LessonGpu & { models: ModelContext }, groundSky: GroundSky, sound: { narrationManifest: NarrationManifest | null; voice: VoiceSignals }) {
  const soundToggle = requireElement<HTMLInputElement>('#narration-sound-toggle')
  const missions = createMissionTours(explorer, gpu, new MissionNarration(sound.narrationManifest, soundToggle, sound.voice))
  const { session: lessons, firstFrame } = createLessons(explorer, gpu, groundSky, { voice: new LessonNarration(sound.narrationManifest, soundToggle, sound.voice), missions })
  const exploring = () => !lessons.active && !missions.session.active
  const now = () => ({ daysSinceEpoch: ephemerisAt(explorer.clock.getCurrentDate()).daysSinceEpoch, scaleBlend: explorer.scaleMode.blend })
  const spacecraft = new ExploreSpacecraft(gpu.models, { exploring, now })
  return { lessons, firstFrame, players: new ScenePlayers([lessons, missions.session, spacecraft]) }
}

// The scene's GPU side, its load state mirrored onto the canvas for tests to wait on.
async function createRendering(gpu: GpuContext, canvas: HTMLCanvasElement) {
  const targets = await SceneTargets.create(gpu, canvas)
  canvas.dataset.bloomSupported = String(targets.bloomSupported)
  const linePipeline = await createLinePipeline(gpu.device, targets.sceneFormat)
  const features = await createSceneFeatures(gpu.device, targets.sceneFormat, linePipeline)
  // The lessons' sky and horizon, drawn only while a lesson shows the view from the ground.
  const groundSky = await GroundSky.create(gpu.device, targets.sceneFormat)
  // Spacecraft models (the Voyager lessons); their files load when a lesson first needs them.
  const models = await createModelContext(gpu.device, targets.sceneFormat, await TextureLoader.create(gpu.device))
  canvas.dataset.texturesLoaded = 'true'
  canvas.dataset.starCount = String(features.starfield.starCount)
  return { targets, linePipeline, features, groundSky, models }
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

// The lessons, and the HUD around everything: the bar (its context following lessons and tours),
// the start page, More and the search-everything palette.
function createLessons(explorer: ReturnType<typeof createExplorer>, gpu: LessonGpu & { models: ModelContext }, groundSky: GroundSky, { voice, missions }: { voice: LessonVoice; missions: MissionTours }): { session: LessonSession; firstFrame: () => void } {
  const { camera, lens, canvas, display } = explorer
  const dock = new DockUI(document.querySelectorAll<HTMLButtonElement>('.hud-dock-btn[data-panel]'), requireElement('#hud-sheet'), document.querySelectorAll<HTMLElement>('.hud-sheet-panel'))
  const bar = new BarContextView(document.body)
  explorer.narratedTourChanged.push((flying) => bar.set('tour', flying))
  missions.activeChanged.push((active) => bar.set('mission', active))
  const cameraInput = { setEnabled: (on: boolean) => camera.setInputEnabled(on), setPickEnabled: (on: boolean) => camera.setPickEnabled(on) }
  const progress = new LessonProgress()
  const session: LessonSession = new LessonSession(
    {
      modeController: new LearnModeController(document.body, cameraInput, dock, (active) => bar.set('lesson', active)),
      camera,
      lessonCamera: new LessonCamera(camera.orbit, lens, canvas),
      showControls: () => explorer.guide.showOnce('lesson', 'orbit'),
      display,
      panel: new LessonPanel(requireElement),
      viewControls: new LessonViewControls(requireElement('#lesson-view-reset'), { reset: () => session.resetView() }),
      progress,
      labels: new SeasonsLabels(requireElement),
      stagedScenes: [new EclipseLesson(gpu, groundSky, new EclipseLabels(requireElement)), createPhasesLesson(gpu, groundSky), new VoyagerLesson(gpu, new VoyagerLabels(requireElement('#voyager-labels'), requireElement('#voyager-route-clock'))), new SaturnVLesson(gpu, new VoyagerLabels(requireElement('#voyager-labels'), null))],
      voice,
    },
    gpu,
  )
  const learnUi = new LearnUi(session, progress)
  const tours = createTours(explorer, { learnUi, missions })
  const { firstFrame } = createHud(explorer, { learnUi, progress, dock, tours, bar })
  return { session, firstFrame }
}

function createPhasesLesson(gpu: LessonGpu, groundSky: GroundSky): PhasesLesson {
  const inset = new PhaseInset(requireElement('#moon-phase-inset'), {
    litShape: requireElement('#moon-phase-lit'),
    name: requireElement('#moon-phase-name'),
    lit: requireElement('#moon-phase-lit-share'),
  })
  return new PhasesLesson(gpu, groundSky, { labels: new PhasesLabels(requireElement), inset })
}

function renderFrame(app: Explorer, time: FrameTime): void {
  const { canvas, scaleMode, camera, lens, clock, players } = app
  players.update(time.deltaSeconds)
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
  const { layout, smallBodies } = frameScene(app, ephemeris)
  showFrame(app, { layout, viewpoint, smallBodies })
  app.renderer.render({ layout, viewpoint, nowSeconds: time.nowSeconds, clock: { daysSinceEpoch: ephemeris.daysSinceEpoch, scaleBlend: scaleMode.blend } })
  frameShown(app, time)
}

// The frame's scene: a lesson's or tour's own, or the explore view's real solar system - only that
// one shows the comets, asteroids and spacecraft (on the explore clock's date, at its scale).
function frameScene(app: Explorer, ephemeris: Ephemeris): Pick<ShownFrame, 'layout' | 'smallBodies'> {
  const { display, scaleMode, players } = app
  const staged = players.layout(ephemeris)
  if (staged) return { layout: staged, smallBodies: [] }
  return { layout: exploreLayout(ephemeris, scaleMode.blend, display.moons.on), smallBodies: shownSmallBodies(display, ephemeris, scaleMode.blend) }
}

function frameShown(app: Explorer, time: FrameTime): void {
  app.fps.frame(time.realDeltaSeconds)
  markRendered(app)
  showOrbitState(app)
}

// The orbit camera's distance and pivot on the canvas, for the end-to-end tests to read (written
// only when they change).
function showOrbitState({ canvas, camera }: Explorer): void {
  const { dataset } = canvas
  const radius = camera.orbit.radius.toPrecision(6)
  const pivot = Array.from(camera.orbit.pivot(), (value) => value.toPrecision(6)).join(',')
  if (dataset.orbitRadius !== radius) dataset.orbitRadius = radius
  if (dataset.pivot !== pivot) dataset.pivot = pivot
}

// The first frame (everything is loaded by then: startApp awaits it all) is where tests start, and
// where a first visit gets the start page.
function markRendered(app: Explorer): void {
  if (app.canvas.dataset.rendered) return
  app.canvas.dataset.rendered = 'true'
  app.firstFrame()
}

// Labels, and what free flight and picking work from in the next frame.
function showFrame(app: Explorer, frame: ShownFrame): void {
  app.bodyLabels.update(frame.layout, frame.viewpoint, app.display.bodyLabels.on, frame.smallBodies)
  app.shown.frame = frame
  app.camera.setSurroundings(obstaclesIn(frame.layout))
}
