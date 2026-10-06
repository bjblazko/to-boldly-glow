import { isTextEntryTarget } from '../camera/inputController'
import type { CameraDirector } from '../camera/cameraDirector'
import type { CameraMode } from '../camera/inputController'

export interface CameraControlElements {
  canvas: HTMLCanvasElement
  modeButton: HTMLButtonElement | null
  tourButton: HTMLButtonElement | null
}

// The Camera panel's buttons (orbit/free-fly, tour), and handing control back from the tour: any
// manual camera input while touring stops it.
export class CameraControls {
  private readonly modeLabel: HTMLElement | null
  private readonly tourLabel: HTMLElement | null

  constructor(
    private readonly elements: CameraControlElements,
    private readonly startTour: () => void,
  ) {
    this.modeLabel = elements.modeButton?.querySelector<HTMLElement>('.btn-label') ?? null
    this.tourLabel = elements.tourButton?.querySelector<HTMLElement>('.btn-label') ?? null
  }

  bind(camera: CameraDirector): void {
    const { canvas, modeButton, tourButton } = this.elements
    modeButton?.addEventListener('click', () => camera.setMode(camera.mode === 'orbit' ? 'fly' : 'orbit'))
    tourButton?.addEventListener('click', () => (camera.isTouring ? camera.stopTour() : this.startTour()))
    canvas.addEventListener('pointerdown', () => camera.stopTour())
    canvas.addEventListener('wheel', () => camera.stopTour())
    window.addEventListener('keydown', (event) => {
      // Enter/Space on a focused button activate that button, whose own click handler decides
      // (stopping here first made the Stop Tour button restart the tour from the keyboard).
      const activatesButton = (event.key === 'Enter' || event.key === ' ') && event.target instanceof HTMLButtonElement
      if (!isTextEntryTarget(event.target) && !activatesButton) camera.stopTour()
    })
  }

  showMode(mode: CameraMode): void {
    if (this.modeLabel) this.modeLabel.textContent = mode === 'orbit' ? 'Switch to Free-fly Camera' : 'Switch to Orbit Camera'
  }

  showTour(touring: boolean): void {
    if (this.tourLabel) this.tourLabel.textContent = touring ? 'Stop Tour' : 'Start Tour'
  }
}
