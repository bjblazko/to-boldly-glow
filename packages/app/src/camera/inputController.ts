import type { OrbitCamera } from './orbitCamera'
import { NO_COMMAND, type FlightCommand, type FlyCamera } from './flyCamera'
import { combineCommands, keyboardFlightCommand, keyboardOrbitTurn, ORBIT_KEY_TURN_PX_PER_SECOND, ORBIT_KEY_ZOOM_PER_SECOND } from './input/flightInput'
import { clampSpeedLevel, cruiseSpeed, keepOutside, type Obstacle } from './input/flightSpeed'
import { KeyboardState } from './input/keyboardState'
import { OrbitMotion } from './input/orbitMotion'
import { PointerGestures } from './input/pointerGestures'

export { isTextEntryTarget } from './input/keyboardState'

export type CameraMode = 'orbit' | 'fly'

// Radians of view turn per pixel of drag in free flight.
const LOOK_RADIANS_PER_PX = 0.0035
// Mouse-wheel zoom: a typical notch (100) zooms by about 13%.
const WHEEL_ZOOM_PER_UNIT = 0.0012
// Wheel travel per speed step in free flight (one notch), and pinch spread per step on touch.
const WHEEL_PER_SPEED_STEP = 100
const PINCH_LOG_PER_SPEED_STEP = 0.25

export interface CameraInputEvents {
  // A double click or double tap on the canvas (client coordinates).
  onDoubleTap(x: number, y: number): void
  onSpeedLevelChange(level: number): void
}

// Routes mouse, touch, wheel and keyboard input to whichever camera is active:
// - orbit: drag (one finger) to turn around the target, wheel or pinch to zoom, WASD/arrows to
//   turn and R/F to zoom from the keyboard - all with a little weight (see orbitMotion.ts);
// - free flight: WASD/arrows to fly and strafe, R/F up and down, Q/E roll, Shift boost, drag to
//   look around, wheel (or pinch) to set the speed - or the on-screen pad on a touch screen.
export class CameraInputController {
  mode: CameraMode = 'orbit'

  private enabled = true
  private readonly keys = new KeyboardState(() => this.enabled)
  private readonly orbitMotion: OrbitMotion
  private readonly gestures: PointerGestures
  private obstacles: readonly Obstacle[] = []
  private speedLevel = 0
  private wheelTravel = 0
  private pinchTravel = 0
  private touchCommand: () => FlightCommand = () => NO_COMMAND

  constructor(
    canvas: HTMLCanvasElement,
    private readonly orbitCamera: OrbitCamera,
    private readonly flyCamera: FlyCamera,
    private readonly events: CameraInputEvents = { onDoubleTap: () => {}, onSpeedLevelChange: () => {} },
  ) {
    this.orbitMotion = new OrbitMotion(orbitCamera)
    this.gestures = new PointerGestures(
      canvas,
      {
        drag: (deltaX, deltaY, touch) => this.onDrag(deltaX, deltaY, touch),
        pinch: (factor) => this.onPinch(factor),
        release: () => this.orbitMotion.release(),
        doubleTap: (x, y) => this.events.onDoubleTap(x, y),
      },
      () => this.enabled,
    )
    canvas.addEventListener('wheel', this.onWheel, { passive: false })
  }

  setMode(mode: CameraMode): void {
    this.mode = mode
    this.orbitMotion.stop()
    this.flyCamera.stop()
  }

  // Learn mode and the tour lock the camera: input stops responding entirely - not just visually,
  // a lingering drag or held key could otherwise fight them. No camera pose is touched here.
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (enabled) return
    this.gestures.cancel()
    this.keys.clear()
    this.orbitMotion.stop()
    this.flyCamera.stop()
  }

  // A zoom step from a button: glides like a wheel notch (positive moves out). Orbit camera only.
  zoom(logFactor: number): void {
    if (this.enabled && this.mode === 'orbit') this.orbitMotion.zoom(logFactor)
  }

  // The bodies around the ship this frame: they set its cruising speed and stop it at their surfaces.
  setObstacles(obstacles: readonly Obstacle[]): void {
    this.obstacles = obstacles
  }

  setTouchCommand(command: () => FlightCommand): void {
    this.touchCommand = command
  }

  getViewMatrix() {
    return this.mode === 'orbit' ? this.orbitCamera.getViewMatrix() : this.flyCamera.getViewMatrix()
  }

  update(deltaSeconds: number): void {
    if (!this.enabled) return
    if (this.mode === 'orbit') this.steerOrbit(deltaSeconds)
    else this.steerFlight(deltaSeconds)
  }

  private steerOrbit(deltaSeconds: number): void {
    const { turn, zoom } = keyboardOrbitTurn(this.keys)
    if (turn[0] !== 0 || turn[1] !== 0) this.orbitCamera.applyDrag(turn[0] * ORBIT_KEY_TURN_PX_PER_SECOND * deltaSeconds, turn[1] * ORBIT_KEY_TURN_PX_PER_SECOND * deltaSeconds)
    if (zoom !== 0) this.orbitCamera.zoomBy(Math.exp(zoom * ORBIT_KEY_ZOOM_PER_SECOND * deltaSeconds))
    this.orbitMotion.update(deltaSeconds)
  }

  private steerFlight(deltaSeconds: number): void {
    const command = combineCommands(keyboardFlightCommand(this.keys), this.touchCommand())
    const speed = cruiseSpeed(this.flyCamera.position, this.obstacles, this.speedLevel)
    this.flyCamera.fly(command, deltaSeconds, speed)
    keepOutside(this.flyCamera.position, this.flyCamera.velocity, this.obstacles)
  }

  // A mouse turns the view the way it moves; a finger drags the sky along with it.
  private onDrag(deltaX: number, deltaY: number, touch: boolean): void {
    if (this.mode === 'orbit') {
      this.orbitMotion.drag(deltaX, deltaY)
      return
    }
    const direction = touch ? -1 : 1
    this.flyCamera.look(direction * deltaX * LOOK_RADIANS_PER_PX, -direction * deltaY * LOOK_RADIANS_PER_PX)
  }

  private onPinch(factor: number): void {
    if (this.mode === 'orbit') {
      this.orbitMotion.zoom(-Math.log(factor))
      return
    }
    this.pinchTravel += Math.log(factor)
    const steps = Math.trunc(this.pinchTravel / PINCH_LOG_PER_SPEED_STEP)
    this.pinchTravel -= steps * PINCH_LOG_PER_SPEED_STEP
    this.changeSpeedLevel(steps)
  }

  private onWheel = (event: WheelEvent) => {
    if (!this.enabled) return
    event.preventDefault()
    if (this.mode === 'fly') this.wheelSpeed(event.deltaY)
    // Trackpad pinch: browsers report it as a wheel event with ctrlKey set (not a real Ctrl press).
    else if (event.ctrlKey) this.orbitMotion.zoom(event.deltaY * WHEEL_ZOOM_PER_UNIT * 5)
    // Trackpad two-finger scroll reports deltaX too (a plain wheel never does): it turns the view,
    // as click-and-drag is uncomfortable on a trackpad.
    else if (event.deltaX !== 0) this.orbitCamera.applyDrag(-event.deltaX, -event.deltaY)
    else this.orbitMotion.zoom(event.deltaY * WHEEL_ZOOM_PER_UNIT)
  }

  private wheelSpeed(deltaY: number): void {
    this.wheelTravel -= deltaY
    const steps = Math.trunc(this.wheelTravel / WHEEL_PER_SPEED_STEP)
    this.wheelTravel -= steps * WHEEL_PER_SPEED_STEP
    this.changeSpeedLevel(steps)
  }

  private changeSpeedLevel(steps: number): void {
    if (steps === 0) return
    const level = clampSpeedLevel(this.speedLevel + steps)
    if (level === this.speedLevel) return
    this.speedLevel = level
    this.events.onSpeedLevelChange(level)
  }
}
