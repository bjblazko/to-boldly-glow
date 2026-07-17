import type { OrbitCamera } from './orbitCamera'
import type { FlyCamera } from './flyCamera'

export type CameraMode = 'orbit' | 'fly'

const MOVE_SPEED = 20 // scene units per second

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

  getViewMatrix() {
    return this.mode === 'orbit' ? this.orbitCamera.getViewMatrix() : this.flyCamera.getViewMatrix()
  }

  update(deltaSeconds: number): void {
    if (this.mode !== 'fly') return
    const distance = MOVE_SPEED * deltaSeconds
    if (this.pressedKeys.has('KeyW')) this.flyCamera.moveForward(distance)
    if (this.pressedKeys.has('KeyS')) this.flyCamera.moveForward(-distance)
    if (this.pressedKeys.has('KeyD')) this.flyCamera.moveRight(distance)
    if (this.pressedKeys.has('KeyA')) this.flyCamera.moveRight(-distance)
  }

  private onPointerDown = (event: PointerEvent) => {
    this.isDragging = true
    this.lastPointerX = event.clientX
    this.lastPointerY = event.clientY
    this.canvas.setPointerCapture(event.pointerId)
  }

  private onPointerMove = (event: PointerEvent) => {
    if (!this.isDragging) return
    const deltaX = event.clientX - this.lastPointerX
    const deltaY = event.clientY - this.lastPointerY
    this.lastPointerX = event.clientX
    this.lastPointerY = event.clientY

    if (this.mode === 'orbit') {
      this.orbitCamera.applyDrag(deltaX, deltaY)
    } else {
      this.flyCamera.applyLook(deltaX, deltaY)
    }
  }

  private onPointerUp = (event: PointerEvent) => {
    this.isDragging = false
    this.canvas.releasePointerCapture(event.pointerId)
  }

  private onWheel = (event: WheelEvent) => {
    if (this.mode !== 'orbit') return
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
    // trackpad. Sensitivity here is a feel parameter, not a correctness one — see plan Context.
    if (event.deltaX !== 0) {
      this.orbitCamera.applyDrag(-event.deltaX, -event.deltaY, 1)
      return
    }

    // Plain mouse wheel: zoom.
    this.orbitCamera.applyZoom(event.deltaY)
  }

  private onKeyDown = (event: KeyboardEvent) => {
    this.pressedKeys.add(event.code)
  }

  private onKeyUp = (event: KeyboardEvent) => {
    this.pressedKeys.delete(event.code)
  }
}
