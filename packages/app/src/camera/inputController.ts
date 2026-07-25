import type { OrbitCamera } from './orbitCamera'
import type { FlyCamera } from './flyCamera'

export type CameraMode = 'orbit' | 'fly'

const ROTATE_SPEED = 1.5 // radians per second, for keyboard-driven yaw/pitch
const SPEED_ACCEL = 40 // scene units per second^2, for arrow-key cruise speed changes

// Wires pointer (mouse + single-finger touch, unified via the Pointer Events API), wheel, and
// keyboard events to whichever camera is active, and exposes one getViewMatrix()/update() pair
// so the render loop doesn't need to know which mode is active.
//
// Deliberately out of scope for this plan (see plan Context): pinch-to-zoom via touch, and touch
// controls for fly mode (WASD has no touch equivalent without a dedicated UI widget).
export class CameraInputController {
  mode: CameraMode = 'orbit'

  private isDragging = false
  private lastPointerX = 0
  private lastPointerY = 0
  private pressedKeys = new Set<string>()
  private enabled = true

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly orbitCamera: OrbitCamera,
    private readonly flyCamera: FlyCamera,
  ) {
    canvas.addEventListener('pointerdown', this.onPointerDown)
    canvas.addEventListener('pointermove', this.onPointerMove)
    canvas.addEventListener('pointerup', this.onPointerUp)
    canvas.addEventListener('pointercancel', this.onPointerUp)
    canvas.addEventListener('wheel', this.onWheel, { passive: false })
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
  }

  setMode(mode: CameraMode): void {
    this.mode = mode
  }

  // Learn mode locks the camera to each chapter's authored framing — free drag/zoom/fly-keys must
  // stop responding to input entirely while it's active, not just visually (a lingering drag could
  // still fight the chapter's tween otherwise). Re-enabling on exit restores exactly the previous
  // interactive behavior; no camera state is touched here.
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (!enabled) this.isDragging = false
  }

  getViewMatrix() {
    return this.mode === 'orbit' ? this.orbitCamera.getViewMatrix() : this.flyCamera.getViewMatrix()
  }

  update(deltaSeconds: number): void {
    if (!this.enabled || this.mode !== 'fly') return
    const rotateAmount = ROTATE_SPEED * deltaSeconds
    if (this.pressedKeys.has('KeyW')) this.flyCamera.turnPitch(rotateAmount)
    if (this.pressedKeys.has('KeyS')) this.flyCamera.turnPitch(-rotateAmount)
    if (this.pressedKeys.has('KeyD')) this.flyCamera.turnRoll(rotateAmount)
    if (this.pressedKeys.has('KeyA')) this.flyCamera.turnRoll(-rotateAmount)

    const speedAccel = SPEED_ACCEL * deltaSeconds
    if (this.pressedKeys.has('ArrowUp')) this.flyCamera.changeSpeed(speedAccel)
    if (this.pressedKeys.has('ArrowDown')) this.flyCamera.changeSpeed(-speedAccel)

    this.flyCamera.moveForward(this.flyCamera.speed * deltaSeconds)
  }

  private onPointerDown = (event: PointerEvent) => {
    if (!this.enabled) return
    this.isDragging = true
    this.lastPointerX = event.clientX
    this.lastPointerY = event.clientY
    this.canvas.setPointerCapture(event.pointerId)
  }

  private onPointerMove = (event: PointerEvent) => {
    if (!this.enabled || !this.isDragging || this.mode !== 'orbit') return
    const deltaX = event.clientX - this.lastPointerX
    const deltaY = event.clientY - this.lastPointerY
    this.lastPointerX = event.clientX
    this.lastPointerY = event.clientY

    this.orbitCamera.applyDrag(deltaX, deltaY)
  }

  private onPointerUp = (event: PointerEvent) => {
    this.isDragging = false
    this.canvas.releasePointerCapture(event.pointerId)
  }

  private onWheel = (event: WheelEvent) => {
    if (!this.enabled || this.mode !== 'orbit') return
    event.preventDefault()

    // Trackpad pinch gesture: browsers report this as a wheel event with ctrlKey set (a
    // long-standing convention — not an actual Ctrl key press) and deltaY carrying the pinch
    // amount. Pinch deltas are small, so scale up to feel comparable to mouse-wheel zoom.
    if (event.ctrlKey) {
      this.orbitCamera.applyZoom(event.deltaY * 5)
      return
    }

    // Trackpad two-finger scroll: reports both deltaX and deltaY (a plain mouse wheel only ever
    // reports deltaY). Treat this as an orbit drag, since click-and-drag is uncomfortable on a
    // trackpad. Uses applyDrag's default sensitivity, matching the pointer-drag path exactly,
    // since both are drag-sourced orbit gestures with comparable delta magnitudes. If this feels
    // too fast or slow on real trackpad hardware, adjusting it is a feel/UX tuning matter, not a
    // correctness one — see plan Context on sign/sensitivity conventions.
    if (event.deltaX !== 0) {
      this.orbitCamera.applyDrag(-event.deltaX, -event.deltaY)
      return
    }

    // Plain mouse wheel: zoom.
    this.orbitCamera.applyZoom(event.deltaY)
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (!this.enabled) return
    this.pressedKeys.add(event.code)
  }

  private onKeyUp = (event: KeyboardEvent) => {
    this.pressedKeys.delete(event.code)
  }
}
