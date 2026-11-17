import { twoFingerMove, type Point } from './twoFingers'

export interface GestureHandlers {
  // One pointer moved (CSS pixels); `touch` tells a finger from a mouse or pen.
  drag(deltaX: number, deltaY: number, touch: boolean): void
  // The scene is pulled along (CSS pixels): a right- or Shift-drag, or two fingers moving together
  // (`touch`).
  pan(deltaX: number, deltaY: number, touch: boolean): void
  // Two fingers moved apart (factor > 1) or together (< 1), about their midpoint (client coordinates).
  pinch(factor: number, centerX: number, centerY: number): void
  // Every pointer was lifted.
  release(): void
  // Two quick taps or clicks in the same spot (client coordinates).
  doubleTap(x: number, y: number): void
}

interface TrackedPointer {
  x: number
  y: number
  downX: number
  downY: number
  downTime: number
  // A right button or Shift held as the press began pans; otherwise it turns.
  pans: boolean
}

// A tap is a short press that barely moves; two of them close in time and place make a double tap.
const TAP_MAX_SECONDS = 0.3
const TAP_MAX_TRAVEL_PX = 8
const DOUBLE_TAP_MAX_SECONDS = 0.4
const DOUBLE_TAP_MAX_DISTANCE_PX = 30

// Turns raw pointer events on the canvas (mouse, pen and touch alike, via the Pointer Events API)
// into drag, pan, pinch and double-tap gestures. A right- or Shift-drag pans; two fingers pan and
// pinch at once.
export class PointerGestures {
  private readonly pointers = new Map<number, TrackedPointer>()
  private lastTap: { time: number; x: number; y: number } | null = null

  constructor(
    private readonly element: HTMLElement,
    private readonly handlers: GestureHandlers,
    private readonly isEnabled: () => boolean,
  ) {
    element.addEventListener('pointerdown', this.onDown)
    element.addEventListener('pointermove', this.onMove)
    element.addEventListener('pointerup', this.onUp)
    element.addEventListener('pointercancel', this.onCancel)
    // The right button pans the scene, so it opens no menu there.
    element.addEventListener('contextmenu', (event) => event.preventDefault())
  }

  cancel(): void {
    this.pointers.clear()
    this.handlers.release()
  }

  private onDown = (event: PointerEvent) => {
    if (!this.isEnabled() || this.pointers.size >= 2) return
    const at = { x: event.clientX, y: event.clientY }
    const pans = event.pointerType !== 'touch' && (event.button === 2 || event.shiftKey)
    this.pointers.set(event.pointerId, { ...at, downX: at.x, downY: at.y, downTime: event.timeStamp / 1000, pans })
    this.element.setPointerCapture?.(event.pointerId)
  }

  private onMove = (event: PointerEvent) => {
    const pointer = this.pointers.get(event.pointerId)
    if (!pointer || !this.isEnabled()) return
    const before = this.fingers()
    const [deltaX, deltaY] = [event.clientX - pointer.x, event.clientY - pointer.y]
    pointer.x = event.clientX
    pointer.y = event.clientY
    const after = this.fingers()
    if (before && after) this.moveTwoFingers(before, after)
    else if (pointer.pans) this.handlers.pan(deltaX, deltaY, false)
    else this.handlers.drag(deltaX, deltaY, event.pointerType === 'touch')
  }

  private moveTwoFingers(before: [Point, Point], after: [Point, Point]): void {
    const { pan, factor, center } = twoFingerMove(before, after)
    if (pan[0] !== 0 || pan[1] !== 0) this.handlers.pan(pan[0], pan[1], true)
    if (factor !== 1) this.handlers.pinch(factor, center.x, center.y)
  }

  private onUp = (event: PointerEvent) => {
    const pointer = this.pointers.get(event.pointerId)
    if (!pointer) return
    this.pointers.delete(event.pointerId)
    if (this.element.hasPointerCapture?.(event.pointerId)) this.element.releasePointerCapture(event.pointerId)
    if (this.isTap(pointer, event)) this.registerTap(event)
    if (this.pointers.size === 0) this.handlers.release()
  }

  private onCancel = (event: PointerEvent) => {
    this.pointers.delete(event.pointerId)
    if (this.pointers.size === 0) this.handlers.release()
  }

  private isTap(pointer: TrackedPointer, event: PointerEvent): boolean {
    const travel = Math.hypot(event.clientX - pointer.downX, event.clientY - pointer.downY)
    return this.pointers.size === 0 && travel <= TAP_MAX_TRAVEL_PX && event.timeStamp / 1000 - pointer.downTime <= TAP_MAX_SECONDS
  }

  private registerTap(event: PointerEvent): void {
    const tap = { time: event.timeStamp / 1000, x: event.clientX, y: event.clientY }
    const previous = this.lastTap
    const isDouble = previous && tap.time - previous.time <= DOUBLE_TAP_MAX_SECONDS && Math.hypot(tap.x - previous.x, tap.y - previous.y) <= DOUBLE_TAP_MAX_DISTANCE_PX
    this.lastTap = isDouble ? null : tap
    if (isDouble) this.handlers.doubleTap(tap.x, tap.y)
  }

  // Where the first two fingers are, or null with fewer than two.
  private fingers(): [Point, Point] | null {
    const [a, b] = [...this.pointers.values()]
    return a && b ? [{ x: a.x, y: a.y }, { x: b.x, y: b.y }] : null
  }
}
