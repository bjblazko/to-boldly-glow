import { mat4, vec3 } from 'gl-matrix'
import { ALL_ENTITIES, type SolarSystemEntity } from '../solarSystem/entities'
import type { Ephemeris } from '../time/ephemeris'
import { CameraFollowController } from './cameraFollow'
import { FlyCamera } from './flyCamera'
import type { FlightCommand } from './flyCamera'
import type { Obstacle } from './input/flightSpeed'
import { clientToNdc } from './input/orbitPan'
import { CameraInputController, type CameraMode } from './inputController'
import { borrowOrbitPose, OrbitCamera, restoreOrbitPose, type OrbitPose } from './orbitCamera'
import { TourController, type TourRoute } from './tourController'
import type { LensShift } from './viewpoint'

// The orbit camera's pose, saved while a lesson borrows the camera.
export interface CameraSnapshot extends OrbitPose {
  mode: CameraMode
}

export interface CameraDirectorEvents {
  onModeChange(mode: CameraMode): void
  onTourChange(touring: boolean): void
  onFollowChange(entity: SolarSystemEntity | null): void
  // A double click or double tap on the scene (client coordinates): fly to what's there.
  onPick(x: number, y: number): void
  onSpeedLevelChange(level: number): void
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
  private pickEnabled = true
  // A staged scene's own use of a double click (a lesson's cabin: look at what was clicked).
  private scenePick: ((ndc: [number, number]) => void) | null = null

  constructor(
    canvas: HTMLCanvasElement,
    private readonly events: CameraDirectorEvents,
  ) {
    this.input = new CameraInputController(canvas, this.orbit, this.fly, {
      onDoubleTap: (x, y) => {
        if (this.scenePick) this.scenePick(clientToNdc(x, y, canvas.getBoundingClientRect()))
        else if (this.pickEnabled) events.onPick(x, y)
      },
      onSpeedLevelChange: (level) => events.onSpeedLevelChange(level),
    })
  }

  get mode(): CameraMode {
    return this.input.mode
  }

  get isTouring(): boolean {
    return this.touring
  }

  // Switching to free-fly starts from the orbit camera's current view, unless syncFlyPose is false:
  // leaving a lesson returns to free-fly exactly where the fly camera was left. Free flight follows
  // nothing, so a followed body is let go.
  setMode(mode: CameraMode, { syncFlyPose = true } = {}): void {
    if (mode === 'fly' && this.follow.followedEntityId) this.stopFollowing()
    if (mode === 'fly' && this.input.mode === 'orbit' && syncFlyPose) {
      const eye = this.orbit.getEyePosition()
      this.fly.setPose(eye, vec3.subtract(vec3.create(), this.orbit.pivot(), eye), this.orbit.upAxis)
    }
    this.input.setMode(mode)
    this.events.onModeChange(mode)
  }

  // The tour starts from wherever the active camera is and whatever it is looking at - on the given
  // route, or else the endless nearest-planet loop.
  startTour(ephemeris: Ephemeris, scaleBlend: number, route?: TourRoute): void {
    if (this.touring) return
    this.touring = true
    this.stopFollowing()
    this.input.setEnabled(false)
    const cameraWorld = mat4.invert(mat4.create(), this.input.getViewMatrix()) ?? mat4.create()
    const eye: [number, number, number] = [cameraWorld[12], cameraWorld[13], cameraWorld[14]]
    const forward: [number, number, number] = [-cameraWorld[8], -cameraWorld[9], -cameraWorld[10]]
    this.tour.start({ position: eye, forward }, ephemeris, scaleBlend, route)
    this.events.onTourChange(true)
  }

  // The tour leaves for its route's next stop now (see TourController.redirect).
  redirectTour(): void {
    this.tour.redirect()
  }

  setTourPaused(paused: boolean): void {
    this.tour.paused = paused
  }

  // Control returns in free-fly mode exactly where the tour was, looking where it looked and with
  // the same roll, so stopping mid-turn doesn't level the view with a jolt.
  stopTour(): void {
    if (!this.touring) return
    this.touring = false
    const eye = vec3.fromValues(...this.tour.getEyePosition())
    const forward = vec3.subtract(vec3.create(), vec3.fromValues(...this.tour.getLookAt()), eye)
    this.fly.setPose(eye, forward, vec3.fromValues(...this.tour.getUp()))
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
    const snapshot: CameraSnapshot = { mode: this.input.mode, ...borrowOrbitPose(this.orbit) }
    this.setMode('orbit')
    return snapshot
  }

  restoreAfterLesson(snapshot: CameraSnapshot): void {
    restoreOrbitPose(this.orbit, snapshot)
    this.setMode(snapshot.mode, { syncFlyPose: false })
  }

  // Stops the glide the user's last input left behind (see CameraInputController.stopMotion).
  stopMotion(): void {
    this.input.stopMotion()
  }

  setInputEnabled(enabled: boolean): void {
    this.input.setEnabled(enabled)
  }

  // Lessons let the user look around their scene but not fly off to a double-clicked body.
  // While set, a double click goes to the scene (in normalized device coordinates) instead.
  setScenePick(pick: ((ndc: [number, number]) => void) | null): void {
    this.scenePick = pick
  }

  setPickEnabled(enabled: boolean): void {
    this.pickEnabled = enabled
  }

  zoom(logFactor: number): void {
    this.input.zoom(logFactor)
  }

  // The bodies around the camera (from the last frame's scene): free flight slows near them and
  // stops at their surfaces.
  setSurroundings(obstacles: readonly Obstacle[]): void {
    this.input.setObstacles(obstacles)
  }

  setTouchFlightCommand(command: () => FlightCommand): void {
    this.input.setTouchCommand(command)
  }

  // Where the lens shift comes from (see CameraLens), so a zoom lands under the pointer.
  setLensSource(source: () => { lensShift: LensShift; fov: number }): void {
    this.input.setLensSource(source)
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
