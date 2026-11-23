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
import { chaseShot, worldFloorUnits, type Framing } from './chaseShot'
import type { Site } from './lunarGround'

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
const SITE_RADIUS_KM = 1735.47
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
    const trajectory = await loadApollo11Trajectory()
    const scene = new Apollo11Scene(trajectory)
    await this.craft.load(siteOf(scene))
    if (attempt !== this.starting) return
    const clock = new Apollo11Clock(APOLLO11_STATIONS, { arrived: (index) => this.arrived(index), ended: () => this.parts.ui.ended() }, !prefersReducedMotion())
    const running: Running = { clock, scene, borrowed: this.borrow(), framing: null, rate: 0 }
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

  encodeBeforeScene(encoder: GPUCommandEncoder): void {
    if (this.running) this.craft.encodeShadows(encoder)
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
    const framing = chaseShot(craftKm, motion, running.clock.position)
    running.framing = framing
    const look = vec3.normalize(vec3.create(), vec3.sub(vec3.create(), framing.lookKm, framing.eyeKm))
    const { lens, camera } = this.parts
    lens.fov = framing.fov
    lens.lensShift = besideColumnShift(globalThis.innerWidth, globalThis.innerHeight)
    // The orbit camera turns about a point ahead along the look, as far as its zoom floor: what it
    // looks at is drawn in the metre pass, so the floor can follow the ground alone.
    const floor = worldFloorUnits(groundKm(running.scene, framing.eyeKm))
    lens.setLessonZoomFloor(floor)
    const distanceUnits = floor * 1.01
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

// How far a point (km from the origin) is above the nearest ground: Earth's, or the Moon's at the
// landing site's radius (Tranquility Base lies some 2 km below the Moon's mean radius).
function groundKm(scene: Apollo11Scene, km: Vec3): number {
  const [earth, moon] = [scene.earthKm(), scene.moonKm()]
  const above = (centre: Vec3, radius: number) => Math.hypot(km[0] - centre[0], km[1] - centre[1], km[2] - centre[2]) - radius
  return Math.min(above(earth, 6378), above(moon, SITE_RADIUS_KM))
}

// Where Eagle stood, as the ground round it is built.
function siteOf(scene: Apollo11Scene): Site {
  const site = scene.siteMoonFrameKm()
  if (!site) return { latitude: 0.67416, longitude: 23.47314, radiusKm: 1735.47 }
  const radiusKm = Math.hypot(site[0], site[1], site[2])
  return { latitude: (Math.asin(site[2] / radiusKm) * 180) / Math.PI, longitude: (Math.atan2(site[1], site[0]) * 180) / Math.PI, radiusKm }
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
