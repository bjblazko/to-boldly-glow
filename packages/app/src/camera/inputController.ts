import type { OrbitCamera } from './orbitCamera'
import { NO_COMMAND, type FlightCommand, type FlyCamera } from './flyCamera'
import { combineCommands, keyboardFlightCommand, keyboardOrbitTurn, ORBIT_KEY_TURN_PX_PER_SECOND, ORBIT_KEY_ZOOM_PER_SECOND, WALK_ROLL_PER_SECOND } from './input/flightInput'
import { clampSpeedLevel, cruiseSpeed, keepOutside, type Obstacle } from './input/flightSpeed'
import { KeyboardState } from './input/keyboardState'
import { OrbitMotion } from './input/orbitMotion'
import { clientToNdc, panByPixels, type ScreenFrame } from './input/orbitPan'
import { NO_LENS_SHIFT, VERTICAL_FOV_RADIANS, type LensShift } from './viewpoint'
import { PointerGestures } from './input/pointerGestures'
import { WheelClassifier } from './input/wheelKind'

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
// - orbit: drag (one finger) to turn around the pivot; a trackpad's two-finger scroll, two fingers
//   on a touch screen, or a right- or Shift-drag move the pivot; a mouse wheel or a pinch zooms
//   toward the pointer; the arrows turn and W/S zoom from the keyboard - all with a little weight
//   (see orbitMotion.ts);
// - free flight, as in a spaceship: the arrows steer the nose, W/S thrust forward and back, Q/E
//   roll, Shift boosts, a drag looks around, the wheel (or a pinch) sets the top speed - or the
//   on-screen pad on a touch screen.
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
  private readonly wheelKind = new WheelClassifier()
  // The lens shift lessons apply (see CameraLens), so a zoom lands under the pointer there too.
  private lens: () => { lensShift: LensShift; fov: number } = () => ({ lensShift: NO_LENS_SHIFT, fov: VERTICAL_FOV_RADIANS })

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly orbitCamera: OrbitCamera,
    private readonly flyCamera: FlyCamera,
    private readonly events: CameraInputEvents = { onDoubleTap: () => {}, onSpeedLevelChange: () => {} },
  ) {
    this.orbitMotion = new OrbitMotion(orbitCamera, () => this.screen())
    this.gestures = new PointerGestures(
      canvas,
      {
        drag: (deltaX, deltaY, touch) => this.onDrag(deltaX, deltaY, touch),
        pan: (deltaX, deltaY, touch) => this.onPan(deltaX, deltaY, touch),
        pinch: (factor, centerX, centerY) => this.onPinch(factor, centerX, centerY),
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

  // Drops what is still gliding (a wheel's zoom, a flick's turn): a lesson framing its shot anew must
  // not be zoomed on by the user's last notch.
  stopMotion(): void {
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

  setLensSource(source: () => { lensShift: LensShift; fov: number }): void {
    this.lens = source
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
    const { turn, zoom, roll } = keyboardOrbitTurn(this.keys)
    if (roll !== 0) this.orbitCamera.roll(roll * WALK_ROLL_PER_SECOND * deltaSeconds)
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

  // In free flight a Shift- or right-drag looks around like any drag (Shift is the boost there);
  // two fingers only set the speed.
  private onPan(deltaX: number, deltaY: number, touch: boolean): void {
    if (this.mode === 'orbit') panByPixels(this.orbitCamera, deltaX, deltaY, this.screen())
    else if (!touch) this.onDrag(deltaX, deltaY, false)
  }

  private onPinch(factor: number, centerX: number, centerY: number): void {
    if (this.mode === 'orbit') {
      this.orbitMotion.zoom(-Math.log(factor), this.pointerNdc(centerX, centerY))
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
    if (this.mode === 'fly') return this.wheelSpeed(event.deltaY)
    const action = this.wheelKind.classify(event)
    // A trackpad's two-finger scroll pulls the scene along, as on a map - or, walking through a
    // room, turns the view as a drag does (one looks about rather than sliding sideways).
    if (action === 'pan' && this.orbitCamera.walk) return this.orbitCamera.applyDrag(-event.deltaX, -event.deltaY)
    if (action === 'pan') return panByPixels(this.orbitCamera, -event.deltaX, -event.deltaY, this.screen())
    // Trackpad pinch: browsers report it as a wheel event with ctrlKey set (not a real Ctrl press).
    const perUnit = action === 'pinch' ? WHEEL_ZOOM_PER_UNIT * 5 : WHEEL_ZOOM_PER_UNIT
    this.orbitMotion.zoom(event.deltaY * perUnit, this.pointerNdc(event.clientX, event.clientY))
  }

  private screen(): ScreenFrame {
    const { clientWidth, clientHeight } = this.canvas
    const { lensShift, fov } = this.lens()
    return { heightPx: clientHeight || 1, aspect: clientWidth / (clientHeight || 1), lensShift, tanHalfFov: Math.tan(fov / 2) }
  }

  private pointerNdc(clientX: number, clientY: number): [number, number] {
    return clientToNdc(clientX, clientY, this.canvas.getBoundingClientRect())
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
