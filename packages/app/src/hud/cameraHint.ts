import { speedFactor } from '../camera/input/flightSpeed'
import { formatFixed, msg } from '../i18n/i18n'

const TEXT = msg.ui.camera
const SPEED_SECONDS = 1.5

// A short line over the scene with the free-flight speed setting, shown whenever it changes (the
// controls themselves are on the controls overlay).
export class CameraHint {
  private hideTimer: ReturnType<typeof setTimeout> | undefined

  constructor(private readonly element: HTMLElement) {}

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
