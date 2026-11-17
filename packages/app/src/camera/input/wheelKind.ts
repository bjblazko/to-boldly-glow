// What a wheel event asks the orbit camera for: a trackpad pinch, a mouse wheel's zoom, or a
// trackpad's two-finger scroll, which pans.
export type WheelAction = 'pinch' | 'zoom' | 'pan'

export interface WheelInput {
  deltaX: number
  deltaY: number
  deltaMode: number
  ctrlKey: boolean
  timeStamp: number
}

// Wheel events closer together than this belong to one gesture.
const GESTURE_GAP_MS = 150
// A mouse wheel's first step is a coarse one; a trackpad starts with small ones.
const TRACKPAD_MAX_FIRST_DELTA = 20

// Browsers report a mouse wheel and a trackpad's two-finger scroll alike, so this tells them apart
// by how a gesture starts: a trackpad's first event is fine-grained (fractions, a sideways part, a
// small step), a wheel's is a coarse step or counted in lines. The whole gesture then keeps that
// reading, as a trackpad's scroll may speed up past any threshold. When in doubt, it zooms.
export class WheelClassifier {
  private lastTime = Number.NEGATIVE_INFINITY
  private gesture: 'zoom' | 'pan' = 'zoom'

  classify(event: WheelInput): WheelAction {
    if (event.ctrlKey) return 'pinch'
    if (event.timeStamp - this.lastTime >= GESTURE_GAP_MS) this.gesture = looksLikeTrackpad(event) ? 'pan' : 'zoom'
    this.lastTime = event.timeStamp
    return this.gesture
  }
}

function looksLikeTrackpad({ deltaX, deltaY, deltaMode }: WheelInput): boolean {
  if (deltaMode !== 0) return false
  return deltaX !== 0 || !Number.isInteger(deltaY) || Math.abs(deltaY) < TRACKPAD_MAX_FIRST_DELTA
}
