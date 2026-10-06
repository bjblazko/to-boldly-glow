import type { OrbitCamera } from './orbitCamera'
import type { FlyCamera } from './flyCamera'

export type CameraMode = 'orbit' | 'fly'

const NON_TEXT_INPUT_TYPES = new Set(['button', 'checkbox', 'radio', 'submit', 'reset', 'image', 'color', 'file'])

// True when a key event is aimed at a control that consumes typing or arrow keys itself (the
// search box, the time-shuttle range slider, a <select>) - those keys belong to that control, not
// to the camera.
export function isTextEntryTarget(target: EventTarget | null): boolean {
  if (typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true
  return target instanceof HTMLInputElement && !NON_TEXT_INPUT_TYPES.has(target.type)
}

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
  // The one pointer driving the current drag - a second touch would otherwise feed its own
  // coordinates into the same lastPointer state, making the orbit jump back and forth between
  // the two fingers on every move event.
  private dragPointerId: number | null = null
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
    // A key released while the window doesn't have focus (alt-tab, a dialog) never delivers its
    // keyup here, which used to leave the fly camera pitching/rolling/accelerating on its own.
    window.addEventListener('blur', this.onWindowBlur)
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
    if (!enabled) {
      this.isDragging = false
      this.dragPointerId = null
    }
  }

  getViewMatrix() {
    return this.mode === 'orbit' ? this.orbitCamera.getViewMatrix() : this.flyCamera.getViewMatrix()
  }

  update(deltaSeconds: number): void {
    if (!this.enabled || this.mode !== 'fly') return
    const turn = ROTATE_SPEED * deltaSeconds
    this.flyCamera.turnPitch(turn * this.keyAxis('KeyW', 'KeyS'))
    this.flyCamera.turnRoll(turn * this.keyAxis('KeyD', 'KeyA'))
    this.flyCamera.changeSpeed(SPEED_ACCEL * deltaSeconds * this.keyAxis('ArrowUp', 'ArrowDown'))
    this.flyCamera.moveForward(this.flyCamera.speed * deltaSeconds)
  }

  // +1 while only the positive key is held, -1 for only the negative one, 0 for neither or both.
  private keyAxis(positiveKey: string, negativeKey: string): number {
    return Number(this.pressedKeys.has(positiveKey)) - Number(this.pressedKeys.has(negativeKey))
  }

  private onPointerDown = (event: PointerEvent) => {
    if (!this.enabled || this.isDragging) return
    this.isDragging = true
    this.dragPointerId = event.pointerId
    this.lastPointerX = event.clientX
    this.lastPointerY = event.clientY
    this.canvas.setPointerCapture(event.pointerId)
  }

  private onPointerMove = (event: PointerEvent) => {
    if (!this.enabled || !this.isDragging || event.pointerId !== this.dragPointerId || this.mode !== 'orbit') return
    const deltaX = event.clientX - this.lastPointerX
    const deltaY = event.clientY - this.lastPointerY
    this.lastPointerX = event.clientX
    this.lastPointerY = event.clientY

    this.orbitCamera.applyDrag(deltaX, deltaY)
  }

  private onPointerUp = (event: PointerEvent) => {
    if (event.pointerId !== this.dragPointerId) return
    this.isDragging = false
    this.dragPointerId = null
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId)
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
    // Typing "was" into the search box, or arrowing the time-shuttle slider, must not also steer
    // the ship.
    if (!this.enabled || isTextEntryTarget(event.target)) return
    this.pressedKeys.add(event.code)
  }

  private onKeyUp = (event: KeyboardEvent) => {
    this.pressedKeys.delete(event.code)
  }

  private onWindowBlur = () => {
    this.pressedKeys.clear()
  }
}
