import type { CameraMode } from '../camera/inputController'
import { speedFactor } from '../camera/input/flightSpeed'
import { formatFixed, msg } from '../i18n/i18n'

const TEXT = msg.ui.camera
const HINTS: Record<CameraMode, { pointer: string; touch: string }> = {
  orbit: { pointer: TEXT.hints.orbitPointer, touch: TEXT.hints.orbitTouch },
  fly: { pointer: TEXT.hints.flyPointer, touch: TEXT.hints.flyTouch },
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
    this.show(TEXT.flightSpeed(factor >= 1 ? formatFixed(factor, factor < 10 ? 1 : 0) : `1/${formatFixed(1 / factor, 1)}`), SPEED_SECONDS)
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
