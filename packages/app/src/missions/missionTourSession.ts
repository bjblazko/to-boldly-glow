import type { CameraDirector, CameraSnapshot } from '../camera/cameraDirector'
import type { CameraLens } from '../camera/cameraLens'
import type { Viewpoint } from '../camera/viewpoint'
import { COMPACT_MIN_ORBIT_RADIUS } from '../camera/orbitCamera'
import type { DisplaySettings, LessonDisplaySnapshot } from '../hud/displaySettings'
import { msg } from '../i18n/i18n'
import { loadVoyagerAssets } from '../learn/voyager/voyagerAssets'
import type { VoyagerLabels } from '../learn/voyager/voyagerLabels'
import type { VoyagerProbeId } from '../learn/voyager/voyagerStage'
import type { ScenePlayer } from '../scene/scenePlayers'
import type { SceneLayout } from '../scene/sceneLayout'
import type { ModelContext } from '../spacecraft/modelRenderer'
import { encounterGoal, flightGoal, steerCamera, type CameraGoal } from './missionCamera'
import type { MissionNarration } from './missionNarration'
import { MissionPlayer, type MissionMoment } from './missionPlayer'
import { MissionScenes } from './missionScenes'
import { missionClipId, stationDay, type Mission, type Station } from './missionTimeline'
import type { MissionTourUi } from './missionTourUi'
import { VOYAGER_MISSIONS } from './voyagerMissions'

export interface MissionTourParts {
  camera: CameraDirector
  lens: CameraLens
  display: DisplaySettings
  gpu: { device: GPUDevice; linePipeline: GPURenderPipeline; models: ModelContext }
  ui: MissionTourUi
  narration: MissionNarration
  // The probes' names on the route.
  labels: VoyagerLabels
  // Hears when a tour starts (true) and ends (false): the Tours mode button lights up meanwhile.
  activeChanged(active: boolean): void
}

interface Running {
  mission: Mission
  player: MissionPlayer
  scenes: MissionScenes
  borrowed: { camera: CameraSnapshot; display: LessonDisplaySnapshot; maxRadius: number }
  // The phase of the last frame: a change into or out of a flyby cuts the camera.
  lastPhase: MissionMoment['phase'] | null
  // Seconds the tour has been running (not counting pauses): the camera's slow circling.
  seconds: number
}

// The camera's distance ahead of the probe at a flyby: the scene's own zoom floor.
const FLYBY_LOOK_DISTANCE = COMPACT_MIN_ORBIT_RADIUS
const MAX_TOUR_RADIUS = 2000

function prefersReducedMotion(): boolean {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

// Runs a mission tour (Voyager 1 or 2): takes the camera and the scene from the explore view, plays
// the mission's stations and gives everything back when it ends.
export class MissionTourSession implements ScenePlayer {
  private running: Running | null = null
  private starting = 0

  constructor(private readonly parts: MissionTourParts) {}

  get active(): boolean {
    return this.running !== null
  }

  async start(probe: VoyagerProbeId): Promise<void> {
    this.stop()
    const attempt = ++this.starting
    const assets = await loadVoyagerAssets(this.parts.gpu.models)
    if (attempt !== this.starting) return
    const mission = VOYAGER_MISSIONS[probe]
    const scenes = new MissionScenes(this.parts.gpu, assets, probe, this.parts.labels)
    const player = new MissionPlayer(this.plan(mission), { arrived: (index) => this.arrived(index), ended: () => this.parts.ui.ended() }, !prefersReducedMotion())
    this.running = { mission, player, scenes, borrowed: this.borrow(), lastPhase: null, seconds: 0 }
    this.parts.ui.open(mission, {
      togglePause: () => player.setPaused(!player.isPaused),
      previous: () => player.jumpTo(player.moment.stationIndex - 1),
      next: () => player.jumpTo(player.moment.stationIndex + 1),
      jumpTo: (index) => player.jumpTo(index),
      close: () => this.stop(),
    })
    this.parts.activeChanged(true)
    player.start()
  }

  stop(): void {
    this.starting++
    const running = this.running
    if (!running) return
    this.running = null
    this.parts.narration.stop()
    this.parts.ui.close()
    this.parts.labels.hideAll()
    this.giveBack(running.borrowed)
    this.parts.activeChanged(false)
  }

  update(deltaSeconds: number): void {
    const running = this.running
    if (!running) return
    const moment = running.player.update(deltaSeconds)
    if (!moment.paused) running.seconds += deltaSeconds
    const station = running.mission.stations[moment.stationIndex]
    void running.scenes.stage(moment, station)
    const next = running.mission.stations[moment.stationIndex + 1]
    if (next) running.scenes.prefetch(next)
    this.steer(running, moment, station, deltaSeconds)
    this.parts.ui.update(moment, running.scenes.route.probeAu(running.mission.probe).distanceAu)
  }

  layout(): SceneLayout | null {
    const running = this.running
    if (!running) return null
    const moment = running.player.moment
    return running.scenes.layout(moment, running.mission.stations[moment.stationIndex])
  }

  updateOverlays(_layout: SceneLayout, viewpoint: Viewpoint): void {
    const running = this.running
    if (!running) return
    const moment = running.player.moment
    const station = running.mission.stations[moment.stationIndex]
    running.scenes.updateOverlays(moment, station, viewpoint)
    if (MissionScenes.showsFlyby(moment) && running.scenes.isFlybyReady(station)) running.scenes.encounter.prepareProbe(viewpoint)
  }

  drawBehindBodies(): void {}

  drawInFrontOfBodies(pass: GPURenderPassEncoder): void {
    const running = this.running
    if (!running) return
    const moment = running.player.moment
    if (MissionScenes.showsFlyby(moment) && running.scenes.isFlybyReady(running.mission.stations[moment.stationIndex])) running.scenes.encounter.drawProbe(pass)
  }

  drawOverlays(pass: GPURenderPassEncoder): void {
    const running = this.running
    if (!running) return
    const moment = running.player.moment
    if (MissionScenes.showsFlyby(moment) && running.scenes.isFlybyReady(running.mission.stations[moment.stationIndex])) running.scenes.encounter.drawLines(pass)
    else running.scenes.route.drawLines(pass)
  }

  private plan(mission: Mission) {
    const texts = msg.missions[mission.probe].stations
    return {
      stations: mission.stations.map((station) => ({ day: stationDay(station), encounter: Boolean(station.encounter) })),
      readingSeconds: (index: number) => {
        const station = mission.stations[index]
        return this.parts.narration.seconds(missionClipId(mission.probe, station.id), texts[station.id].text)
      },
    }
  }

  private arrived(index: number): void {
    const running = this.running
    if (!running) return
    this.parts.narration.say(missionClipId(running.mission.probe, running.mission.stations[index].id))
    this.parts.ui.showStation(index)
  }

  // The camera follows the probe on the route and rides with it at a flyby; a cut into or out of a
  // flyby (behind the fade) jumps instead of gliding.
  private steer(running: Running, moment: MissionMoment, station: Station, deltaSeconds: number): void {
    const { orbit } = this.parts.camera
    const flyby = MissionScenes.showsFlyby(moment) && running.scenes.isFlybyReady(station)
    const cut = running.lastPhase === null || flyby !== (running.lastPhase === 'encounter' || running.lastPhase === 'fadeOut') || prefersReducedMotion()
    running.lastPhase = moment.phase
    if (flyby) {
      steerCamera(orbit, encounterGoal(running.scenes.encounter.camera(), FLYBY_LOOK_DISTANCE), { deltaSeconds, cut: true })
      return
    }
    steerCamera(orbit, this.routeGoal(running, moment, station), { deltaSeconds, cut })
  }

  // On the route: following the probe toward the next planet, or the station's own view - looking
  // back from the probe only once it is there (on the way, the camera follows it).
  private routeGoal(running: Running, moment: MissionMoment, station: Station): CameraGoal {
    const probe = running.scenes.route.probePosition(running.mission.probe)
    const approaching = moment.phase === 'flight' || moment.phase === 'fadeIn'
    const planet = approaching ? running.scenes.planetPosition(station.encounter, moment.day) : null
    const view = moment.phase === 'flight' && station.view === 'paleBlueDot' ? 'follow' : station.view
    return flightGoal(view, probe, { nextPlanet: planet, seconds: running.seconds })
  }

  private borrow(): Running['borrowed'] {
    const { camera, display, lens } = this.parts
    const borrowed = { camera: camera.takeOverForLesson(), display: display.clearForLesson(), maxRadius: camera.orbit.maxRadius }
    camera.setInputEnabled(false)
    camera.setPickEnabled(false)
    camera.orbit.viewLimits = null
    camera.orbit.maxRadius = MAX_TOUR_RADIUS
    lens.setLessonZoomFloor(COMPACT_MIN_ORBIT_RADIUS)
    lens.lensShiftNdc = 0
    return borrowed
  }

  private giveBack(borrowed: Running['borrowed']): void {
    const { camera, display, lens } = this.parts
    camera.orbit.maxRadius = borrowed.maxRadius
    lens.setLessonZoomFloor(null)
    camera.restoreAfterLesson(borrowed.camera)
    display.restoreAfterLesson(borrowed.display)
    camera.setInputEnabled(true)
    camera.setPickEnabled(true)
  }
}
