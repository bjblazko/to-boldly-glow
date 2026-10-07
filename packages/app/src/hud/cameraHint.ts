import type { CameraMode } from '../camera/inputController'
import { speedFactor } from '../camera/input/flightSpeed'

const HINTS: Record<CameraMode, { pointer: string; touch: string }> = {
  orbit: {
    pointer: 'Drag to orbit · scroll to zoom · WASD/arrows turn · double-click a body to fly there',
    touch: 'Drag to orbit · pinch to zoom · double-tap a body to fly there',
  },
  fly: {
    pointer: 'WASD/arrows fly · drag to look · R/F up/down · Q/E roll · Shift boost · scroll sets speed',
    touch: 'Stick to fly · drag to look · ▲▼ up/down · hold ⚡ to boost · pinch sets speed',
  },
}
const HINT_SECONDS = 7
const SPEED_SECONDS = 1.5

// A short line over the scene telling how the camera is steered, shown for a few seconds after
// switching camera mode, and the free-flight speed setting whenever it changes.
export class CameraHint {
  private hideTimer: ReturnType<typeof setTimeout> | undefined

  constructor(
    private readonly element: HTMLElement,
    private readonly touch: boolean,
  ) {}

  showMode(mode: CameraMode): void {
    this.show(HINTS[mode][this.touch ? 'touch' : 'pointer'], HINT_SECONDS)
  }

  showSpeedLevel(level: number): void {
    const factor = speedFactor(level)
    this.show(`Flight speed ×${factor >= 1 ? factor.toFixed(factor < 10 ? 1 : 0) : `1/${(1 / factor).toFixed(1)}`}`, SPEED_SECONDS)
  }

  hide(): void {
    clearTimeout(this.hideTimer)
    this.element.hidden = true
  }

  private show(text: string, seconds: number): void {
    this.element.textContent = text
    this.element.hidden = false
    clearTimeout(this.hideTimer)
    this.hideTimer = setTimeout(() => (this.element.hidden = true), seconds * 1000)
  }
}
