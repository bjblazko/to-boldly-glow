import { mat4, vec3 } from 'gl-matrix'
import { ALL_ENTITIES, type SolarSystemEntity } from '../solarSystem/entities'
import type { Ephemeris } from '../time/ephemeris'
import { CameraFollowController } from './cameraFollow'
import { FlyCamera } from './flyCamera'
import { CameraInputController, type CameraMode } from './inputController'
import { OrbitCamera } from './orbitCamera'
import { TourController } from './tourController'

// The orbit camera's pose, saved while a lesson borrows the camera.
export interface CameraSnapshot {
  mode: CameraMode
  target: vec3
  radius: number
  azimuth: number
  elevation: number
  upAxis: vec3
}

export interface CameraDirectorEvents {
  onModeChange(mode: CameraMode): void
  onTourChange(touring: boolean): void
  onFollowChange(entity: SolarSystemEntity | null): void
}

// Decides which camera the scene is seen through - the user-driven orbit or free-fly camera, or
// the automatic planet tour - and hands over between them without jumps.
export class CameraDirector {
  // The default view looks down on the ecliptic from 67 degrees above it.
  readonly orbit = new OrbitCamera({ radius: 65, azimuth: 0, elevation: (67 * Math.PI) / 180 })
  private readonly fly = new FlyCamera({ position: [0, 25, 60], yaw: Math.PI, pitch: 0 })
  private readonly input: CameraInputController
  private readonly follow = new CameraFollowController(this.orbit)
  private readonly tour = new TourController(ALL_ENTITIES.filter((entity) => entity.kind === 'planet'))
  private touring = false

  constructor(
    canvas: HTMLCanvasElement,
    private readonly events: CameraDirectorEvents,
  ) {
    this.input = new CameraInputController(canvas, this.orbit, this.fly)
  }

  get mode(): CameraMode {
    return this.input.mode
  }

  get isTouring(): boolean {
    return this.touring
  }

  // Switching to free-fly starts from the orbit camera's current view, unless syncFlyPose is false:
  // leaving a lesson returns to free-fly exactly where the fly camera was left.
  setMode(mode: CameraMode, { syncFlyPose = true } = {}): void {
    if (mode === 'fly' && this.input.mode === 'orbit' && syncFlyPose) {
      const eye = this.orbit.getEyePosition()
      this.fly.setPose(eye, vec3.subtract(vec3.create(), this.orbit.target, eye), this.orbit.upAxis)
      this.fly.speed = 0
    }
    this.input.setMode(mode)
    this.events.onModeChange(mode)
  }

  // The tour starts from wherever the active camera is and whatever it is looking at.
  startTour(ephemeris: Ephemeris, scaleBlend: number): void {
    if (this.touring) return
    this.touring = true
    this.stopFollowing()
    this.input.setEnabled(false)
    const cameraWorld = mat4.invert(mat4.create(), this.input.getViewMatrix()) ?? mat4.create()
    const eye: [number, number, number] = [cameraWorld[12], cameraWorld[13], cameraWorld[14]]
    const forward: [number, number, number] = [-cameraWorld[8], -cameraWorld[9], -cameraWorld[10]]
    this.tour.start({ position: eye, forward }, ephemeris, scaleBlend)
    this.events.onTourChange(true)
  }

  // Control returns in free-fly mode exactly where the tour was, looking where it looked and with
  // the same roll, so stopping mid-turn doesn't level the view with a jolt.
  stopTour(): void {
    if (!this.touring) return
    this.touring = false
    const eye = vec3.fromValues(...this.tour.getEyePosition())
    const forward = vec3.subtract(vec3.create(), vec3.fromValues(...this.tour.getLookAt()), eye)
    this.fly.setPose(eye, forward, vec3.fromValues(...this.tour.getUp()))
    this.fly.speed = 0
    this.tour.stop()
    this.input.setEnabled(true)
    this.setMode('fly', { syncFlyPose: false })
    this.events.onTourChange(false)
  }

  // Flies the orbit camera to the entity and keeps it centered from then on.
  followEntity(entity: SolarSystemEntity, ephemeris: Ephemeris, scaleBlend: number): void {
    this.stopTour()
    if (this.input.mode === 'fly') this.setMode('orbit')
    this.follow.selectEntity(entity, ephemeris.julianMillennia, ephemeris.daysSinceEpoch, scaleBlend)
    this.events.onFollowChange(entity)
  }

  stopFollowing(): void {
    this.follow.stopFollowing()
    this.events.onFollowChange(null)
  }

  // Lessons drive the orbit camera themselves, so nothing else may own the view meanwhile: not the
  // tour, not free-fly, not a follow that would drag the target back to the followed body.
  takeOverForLesson(): CameraSnapshot {
    this.stopTour()
    this.stopFollowing()
    const snapshot: CameraSnapshot = {
      mode: this.input.mode,
      target: vec3.clone(this.orbit.target),
      radius: this.orbit.radius,
      azimuth: this.orbit.azimuth,
      elevation: this.orbit.elevation,
      upAxis: vec3.clone(this.orbit.upAxis),
    }
    this.setMode('orbit')
    return snapshot
  }

  restoreAfterLesson(snapshot: CameraSnapshot): void {
    vec3.copy(this.orbit.target, snapshot.target)
    this.orbit.radius = snapshot.radius
    this.orbit.azimuth = snapshot.azimuth
    this.orbit.elevation = snapshot.elevation
    vec3.copy(this.orbit.upAxis, snapshot.upAxis)
    this.setMode(snapshot.mode, { syncFlyPose: false })
  }

  setInputEnabled(enabled: boolean): void {
    this.input.setEnabled(enabled)
  }

  // Keyboard flight first (it acts on the fly camera directly), then follow and tour, which need
  // the frame's simulated date.
  steer(deltaSeconds: number): void {
    this.input.update(deltaSeconds)
  }

  update(deltaSeconds: number, ephemeris: Ephemeris, scaleBlend: number): void {
    this.follow.update(deltaSeconds, ephemeris.julianMillennia, ephemeris.daysSinceEpoch, scaleBlend)
    if (this.touring) this.tour.update(deltaSeconds, ephemeris, scaleBlend)
  }

  viewMatrix(): mat4 {
    return this.touring ? this.tour.getViewMatrix() : this.input.getViewMatrix()
  }
}
