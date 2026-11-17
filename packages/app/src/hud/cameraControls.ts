import { isTextEntryTarget } from '../camera/inputController'
import type { CameraDirector } from '../camera/cameraDirector'
import type { CameraMode } from '../camera/inputController'

export interface CameraControlElements {
  canvas: HTMLCanvasElement
  orbitButton: HTMLButtonElement
  flyButton: HTMLButtonElement
}

// The bar's camera switch (Orbit | Free flight), showing the mode in use - a switch shows that
// mode's controls - and handing control back from the narrated tour: any manual camera input while
// it flies stops it.
export class CameraControls {
  constructor(
    private readonly elements: CameraControlElements,
    private readonly switched: (mode: CameraMode) => void,
  ) {}

  bind(camera: CameraDirector): void {
    const { canvas, orbitButton, flyButton } = this.elements
    const choose = (mode: CameraMode) => {
      camera.setMode(mode)
      this.switched(mode)
    }
    orbitButton.addEventListener('click', () => choose('orbit'))
    flyButton.addEventListener('click', () => choose('fly'))
    canvas.addEventListener('pointerdown', () => camera.stopTour())
    canvas.addEventListener('wheel', () => camera.stopTour())
    window.addEventListener('keydown', (event) => {
      if (steers(event)) camera.stopTour()
    })
  }

  showMode(mode: CameraMode): void {
    this.elements.orbitButton.setAttribute('aria-pressed', String(mode === 'orbit'))
    this.elements.flyButton.setAttribute('aria-pressed', String(mode === 'fly'))
  }
}

// Whether a key press is the user taking the controls. Not typing in a text box, not Enter/Space on
// a focused button (that button's own click decides), not ? (it only shows the controls), and not a
// shortcut with Ctrl/Cmd/Alt (Ctrl+K searches).
function steers(event: KeyboardEvent): boolean {
  if (isTextEntryTarget(event.target) || event.key === '?') return false
  if (event.ctrlKey || event.metaKey || event.altKey) return false
  return !((event.key === 'Enter' || event.key === ' ') && event.target instanceof HTMLButtonElement)
}
