import { vec3 } from 'gl-matrix'
import type { CameraDirector, CameraSnapshot } from '../../camera/cameraDirector'
import type { CameraLens } from '../../camera/cameraLens'
import { NO_LENS_SHIFT, VERTICAL_FOV_RADIANS, type Viewpoint } from '../../camera/viewpoint'
import type { DisplaySettings, LessonDisplaySnapshot } from '../../hud/displaySettings'
import { msg } from '../../i18n/i18n'
import { besideColumnShift } from '../../learn/lessonFrame'
import type { Vec3 } from '../../math/tuples'
import type { ScenePlayer } from '../../scene/scenePlayers'
import type { SceneLayout } from '../../scene/sceneLayout'
import type { ModelContext } from '../../spacecraft/modelRenderer'
import { encounterGoal, steerCamera } from '../missionCamera'
import type { MissionTourUi, StationCard, TourOutline } from '../missionTourUi'
import type { Scrubbable, TourShuttle } from '../tourShuttle'
import { Apollo11Clock, type ClockMoment } from './apollo11Clock'
import { Apollo11CraftRenderer } from './apollo11CraftRenderer'
import { Apollo11Scene, KM_PER_UNIT, type Craft } from './apollo11Scene'
import { APOLLO11_STATIONS } from './apollo11Stations'
import { loadApollo11Trajectory } from './apollo11Trajectory'
import { chaseShot, nearFloorUnits, type Framing } from './chaseShot'

export interface Apollo11TourParts {
  camera: CameraDirector
  lens: CameraLens
  display: DisplaySettings
  gpu: { models: ModelContext }
  ui: MissionTourUi
  shuttle: TourShuttle
  activeChanged(active: boolean): void
}

interface Running {
  clock: Apollo11Clock
  scene: Apollo11Scene
  borrowed: { camera: CameraSnapshot; display: LessonDisplaySnapshot; maxRadius: number; fov: number }
  framing: Framing | null
  // The jog and shuttle's speed (0: the tour plays as it does).
  rate: number
}

const MAX_TOUR_RADIUS = 6000
// Eagle is the one to watch from the undocking to the rendezvous.
const EAGLE_STATIONS = new Set(['undocking', 'landing', 'firstStep', 'liftoff', 'rendezvous'])

function prefersReducedMotion(): boolean {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

// "102:45:40" from seconds.
export function formatGet(get: number): string {
  const whole = Math.max(0, Math.floor(get))
  const [h, m, s] = [Math.floor(whole / 3600), Math.floor((whole % 3600) / 60), whole % 60]
  return `${String(h).padStart(3, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// Runs the Apollo 11 tour: takes the camera and the scene from the explore view, plays the
// stations at true scale and gives everything back when it ends.
export class Apollo11TourSession implements ScenePlayer {
  private running: Running | null = null
  private starting = 0
  private readonly craft: Apollo11CraftRenderer
  private place: (stationId: string | null) => void = () => {}

  constructor(private readonly parts: Apollo11TourParts) {
    this.craft = new Apollo11CraftRenderer(parts.gpu.models)
  }

  get active(): boolean {
    return this.running !== null
  }

  setPlace(place: (stationId: string | null) => void): void {
    this.place = place
  }

  async start(stationIndex: number | null = null): Promise<void> {
    this.stop()
    const attempt = ++this.starting
    const [trajectory] = await Promise.all([loadApollo11Trajectory(), this.craft.load()])
    if (attempt !== this.starting) return
    const clock = new Apollo11Clock(APOLLO11_STATIONS, { arrived: (index) => this.arrived(index), ended: () => this.parts.ui.ended() }, !prefersReducedMotion())
    const running: Running = { clock, scene: new Apollo11Scene(trajectory), borrowed: this.borrow(), framing: null, rate: 0 }
    this.running = running
    this.parts.ui.open(outline(), {
      // While shuttled, Pause stops it where it is.
      togglePause: () => {
        if (running.rate !== 0) running.rate = 0
        clock.setPaused(running.rate === 0 && !clock.isPaused)
      },
      previous: () => clock.jumpTo(clock.moment.stationIndex - 1),
      next: () => clock.jumpTo(clock.moment.stationIndex + 1),
      jumpTo: (index) => clock.jumpTo(index),
      close: () => this.stop(),
    })
    this.parts.shuttle.attach(scrubbable(running))
    this.parts.activeChanged(true)
    clock.start()
    if (stationIndex !== null && stationIndex > 0) clock.jumpTo(stationIndex)
  }

  stop(): void {
    this.starting++
    const running = this.running
    if (!running) return
    this.running = null
    this.parts.ui.close()
    this.parts.shuttle.detach()
    this.place(null)
    this.giveBack(running.borrowed)
    this.parts.activeChanged(false)
  }

  update(deltaSeconds: number): void {
    const running = this.running
    if (!running) return
    if (running.rate !== 0) running.clock.seek(running.clock.position + deltaSeconds * running.rate)
    const moment = running.rate !== 0 ? running.clock.moment : running.clock.update(deltaSeconds)
    const focus: Craft = EAGLE_STATIONS.has(APOLLO11_STATIONS[moment.stationIndex].id) && running.scene.craftKm('eagle') ? 'eagle' : 'columbia'
    running.scene.setMoment(moment.get, focus)
    this.steer(running, focus)
    this.parts.ui.update({ stationIndex: moment.stationIndex, fade: moment.fade, paused: running.rate === 0 && (moment.paused || moment.ended), travelling: false }, this.status(running, moment, focus))
    this.parts.shuttle.update()
  }

  layout(): SceneLayout | null {
    return this.running ? this.running.scene.layout() : null
  }

  updateOverlays(_layout: SceneLayout, viewpoint: Viewpoint): void {
    const running = this.running
    if (!running?.framing) return
    this.craft.prepare(viewpoint, running.scene, { km: cameraKm(viewpoint), fov: this.parts.lens.fov, lensShift: this.parts.lens.lensShift })
  }

  drawBehindBodies(): void {}

  drawInFrontOfBodies(pass: GPURenderPassEncoder): void {
    if (this.running) this.craft.draw(pass)
  }

  drawOverlays(): void {}

  private steer(running: Running, focus: Craft): void {
    const craftKm = running.scene.craftKm(focus)
    const motion = running.scene.motion(focus)
    if (!craftKm || !motion) return
    const framing = chaseShot(craftKm, motion)
    running.framing = framing
    const look = vec3.sub(vec3.create(), framing.lookKm, framing.eyeKm)
    const distanceUnits = vec3.length(look) / KM_PER_UNIT
    vec3.normalize(look, look)
    const { lens, camera } = this.parts
    lens.fov = framing.fov
    lens.lensShift = besideColumnShift(globalThis.innerWidth, globalThis.innerHeight)
    lens.setLessonZoomFloor(nearFloorUnits(distanceUnits, Math.max(0.05, motion.altitudeKm)))
    const eye = framing.eyeKm.map((km) => km / KM_PER_UNIT) as Vec3
    steerCamera(camera.orbit, encounterGoal({ eye, look: [look[0], look[1], look[2]], up: framing.up }, distanceUnits), { deltaSeconds: 0, cut: true })
  }

  private status(running: Running, moment: ClockMoment, focus: Craft): string {
    const motion = running.scene.motion(focus)
    const height = motion ? `${Math.round(motion.altitudeKm).toLocaleString()} km` : ''
    return `GET ${formatGet(moment.get)} · ${height}`
  }

  private arrived(index: number): void {
    if (!this.running) return
    const station = APOLLO11_STATIONS[index]
    this.parts.ui.showStation(index, card(index))
    this.place(station.id)
  }

  private borrow(): Running['borrowed'] {
    const { camera, display, lens } = this.parts
    const borrowed = { camera: camera.takeOverForLesson(), display: display.clearForLesson(), maxRadius: camera.orbit.maxRadius, fov: lens.fov }
    camera.setInputEnabled(false)
    camera.setPickEnabled(false)
    camera.orbit.viewLimits = null
    camera.orbit.maxRadius = MAX_TOUR_RADIUS
    lens.lensShift = NO_LENS_SHIFT
    return borrowed
  }

  private giveBack(borrowed: Running['borrowed']): void {
    const { camera, display, lens } = this.parts
    camera.orbit.maxRadius = borrowed.maxRadius
    lens.fov = borrowed.fov ?? VERTICAL_FOV_RADIANS
    lens.lensShift = NO_LENS_SHIFT
    lens.setLessonZoomFloor(null)
    camera.restoreAfterLesson(borrowed.camera)
    display.restoreAfterLesson(borrowed.display)
    camera.setInputEnabled(true)
    camera.setPickEnabled(true)
  }
}

// The eye's place relative to the scene's origin (km): the viewpoint's, in scene units.
function cameraKm(viewpoint: Viewpoint): Vec3 {
  const p = viewpoint.position
  return [p[0] * KM_PER_UNIT, p[1] * KM_PER_UNIT, p[2] * KM_PER_UNIT]
}

// The tour as the jog and shuttle drive it: shuttling holds the tour's own play, letting go leaves
// it standing where it got to.
function scrubbable(running: Running): Scrubbable {
  const texts = msg.missions.apollo11.stations
  let start = 0
  const stations = APOLLO11_STATIONS.map((station) => {
    const entry = { start, seconds: station.seconds, title: texts[station.id as keyof typeof texts].title }
    start += station.seconds
    return entry
  })
  return {
    get length() {
      return running.clock.length
    },
    get position() {
      return running.clock.position
    },
    get rate() {
      return running.rate
    },
    stations,
    seek: (position) => running.clock.seek(position),
    setRate: (rate) => {
      running.rate = rate
      running.clock.setPaused(true)
    },
    readout: () => `GET ${formatGet(running.clock.moment.get)} · ${stations[running.clock.moment.stationIndex].title}`,
  }
}

function outline(): TourOutline {
  const texts = msg.missions.apollo11.stations
  return { id: 'apollo11', stations: APOLLO11_STATIONS.map((station) => ({ title: texts[station.id as keyof typeof texts].title, mark: formatGet(station.from).slice(0, 3).replace(/^0+(?=\d)/, '') + ' h' })) }
}

function card(index: number): StationCard {
  const station = APOLLO11_STATIONS[index]
  const text = msg.missions.apollo11.stations[station.id as keyof typeof msg.missions.apollo11.stations]
  return { title: text.title, text: text.text, when: `GET ${formatGet(station.from)}` }
}
