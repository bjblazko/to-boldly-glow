import { isTextEntryTarget } from '../camera/inputController'
import type { CameraDirector } from '../camera/cameraDirector'
import type { CameraMode } from '../camera/inputController'
import { msg } from '../i18n/i18n'

export interface CameraControlElements {
  canvas: HTMLCanvasElement
  // The bar's camera key: it shows the mode in use, and a click switches to the other.
  modeButton: HTMLButtonElement
}

const OTHER: Record<CameraMode, CameraMode> = { orbit: 'fly', fly: 'orbit' }

// The bar's camera key (Orbit / Free flight) - a switch shows that mode's controls - and handing
// control back from the narrated tour: any manual camera input while it flies stops it.
export class CameraControls {
  constructor(
    private readonly elements: CameraControlElements,
    private readonly switched: (mode: CameraMode) => void,
  ) {}

  bind(camera: CameraDirector): void {
    const { canvas, modeButton } = this.elements
    modeButton.addEventListener('click', () => {
      const mode = OTHER[camera.mode]
      camera.setMode(mode)
      this.switched(mode)
    })
    canvas.addEventListener('pointerdown', () => camera.stopTour())
    canvas.addEventListener('wheel', () => camera.stopTour())
    window.addEventListener('keydown', (event) => {
      if (steers(event)) camera.stopTour()
    })
  }

  showMode(mode: CameraMode): void {
    const button = this.elements.modeButton
    button.dataset.mode = mode
    button.querySelector('use')?.setAttribute('href', mode === 'orbit' ? '#icon-orbit' : '#icon-fly')
    const label = button.querySelector('.hud-dock-label')
    if (label) label.textContent = msg.ui.camera[mode]
    button.title = msg.ui.camera.switchTo(msg.ui.camera[OTHER[mode]])
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
