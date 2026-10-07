import type { OrbitCamera } from '../orbitCamera'

// A released drag keeps the view turning, slowing to a stop over about this long.
const MOMENTUM_SECONDS = 0.45
// Zoom steps glide in over about this long instead of jumping.
const ZOOM_SECONDS = 0.12
// Turning speeds below this (pixels per second) count as stopped.
const RESTING_SPEED = 2

// Gives the orbit camera weight: drags apply at once but leave momentum behind when released,
// and zooming eases in. Rotation is counted in drag pixels, as OrbitCamera.applyDrag takes them.
export class OrbitMotion {
  private pendingDrag: [number, number] = [0, 0]
  private velocity: [number, number] = [0, 0]
  private pendingZoom = 0
  private dragging = false

  constructor(private readonly camera: OrbitCamera) {}

  drag(deltaX: number, deltaY: number): void {
    this.dragging = true
    this.pendingDrag[0] += deltaX
    this.pendingDrag[1] += deltaY
  }

  release(): void {
    this.dragging = false
  }

  // Zooms by a factor of e^logFactor (positive moves out).
  zoom(logFactor: number): void {
    this.pendingZoom += logFactor
  }

  stop(): void {
    this.pendingDrag = [0, 0]
    this.velocity = [0, 0]
    this.pendingZoom = 0
    this.dragging = false
  }

  update(deltaSeconds: number): void {
    if (deltaSeconds <= 0) return
    this.turn(deltaSeconds)
    const share = this.pendingZoom * (1 - Math.exp(-deltaSeconds / ZOOM_SECONDS))
    this.pendingZoom -= share
    if (share !== 0) this.camera.zoomBy(Math.exp(share))
  }

  private turn(deltaSeconds: number): void {
    const [x, y] = this.pendingDrag
    if (this.dragging || x !== 0 || y !== 0) {
      // While dragging, momentum follows the hand's recent speed - and a hand held still before
      // letting go leaves none.
      const moved = x !== 0 || y !== 0
      const blend = moved ? 1 - Math.exp(-deltaSeconds / 0.05) : 1
      this.velocity = [this.velocity[0] + (x / deltaSeconds - this.velocity[0]) * blend, this.velocity[1] + (y / deltaSeconds - this.velocity[1]) * blend]
      this.pendingDrag = [0, 0]
      this.camera.applyDrag(x, y)
      return
    }
    if (Math.hypot(...this.velocity) < RESTING_SPEED) return
    this.camera.applyDrag(this.velocity[0] * deltaSeconds, this.velocity[1] * deltaSeconds)
    const decay = Math.exp(-deltaSeconds / MOMENTUM_SECONDS)
    this.velocity = [this.velocity[0] * decay, this.velocity[1] * decay]
  }
}
