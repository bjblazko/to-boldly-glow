import type { CameraMode } from '../camera/inputController'
import { isTextEntryTarget } from '../camera/inputController'
import { msg } from '../i18n/i18n'
import { controlGroups, type ControlGroup, type KeyCap } from './controlsGuide'

// Shown on its own, the overlay fades after this long; asked for with ? or Help, it stays.
const VISIBLE_SECONDS = 6

// Both Shift keys light the one Shift cap.
const SAME_CAP: Record<string, string> = { ShiftRight: 'ShiftLeft' }

export interface ControlsOverlayElements {
  // The scene: pressing on it puts the overlay away.
  scene: HTMLElement
  overlay: HTMLElement
  body: HTMLElement
  close: HTMLButtonElement
}

// The camera's controls as a picture: keycaps laid out as on a keyboard, and the gestures, with
// what each does. It appears on switching camera mode and on first opening a lesson, fades after a
// few seconds, and comes back with ? (or the camera panel's Help); a held key lights up on it.
// It never blocks the screen: a click goes through it to what is below, and one on the scene puts
// it away.
export class ControlsOverlay {
  private mode: CameraMode = 'orbit'
  private hideTimer: ReturnType<typeof setTimeout> | undefined
  private readonly shownOnce = new Set<string>()

  constructor(
    private readonly elements: ControlsOverlayElements,
    private readonly touch: boolean,
  ) {
    elements.close.addEventListener('click', () => this.hide())
    elements.scene.addEventListener('pointerdown', () => this.hide())
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', (event) => this.light(event.code, false))
    window.addEventListener('blur', () => this.elements.body.querySelectorAll('.is-pressed').forEach((key) => key.classList.remove('is-pressed')))
  }

  get visible(): boolean {
    return !this.elements.overlay.hidden
  }

  // On its own (a mode switch): fades after a few seconds.
  show(mode: CameraMode): void {
    this.open(mode, true)
  }

  // Asked for: stays until closed.
  showPinned(mode: CameraMode = this.mode): void {
    this.open(mode, false)
  }

  // Once per page for an occasion (the first lesson opened, say).
  showOnce(occasion: string, mode: CameraMode): void {
    if (this.shownOnce.has(occasion)) return
    this.shownOnce.add(occasion)
    this.show(mode)
  }

  hide(): void {
    clearTimeout(this.hideTimer)
    this.elements.overlay.hidden = true
  }

  private open(mode: CameraMode, fades: boolean): void {
    this.mode = mode
    this.elements.body.replaceChildren(...controlGroups(mode, this.touch, msg.ui.controls).map(groupElement))
    this.elements.overlay.hidden = false
    clearTimeout(this.hideTimer)
    if (fades) this.hideTimer = setTimeout(() => this.hide(), VISIBLE_SECONDS * 1000)
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (isTextEntryTarget(event.target)) return
    if (event.key === '?') {
      event.preventDefault()
      if (this.visible) this.hide()
      else this.showPinned()
      return
    }
    if (event.key === 'Escape' && this.visible) this.hide()
    this.light(event.code, true)
  }

  private light(code: string, pressed: boolean): void {
    const key = this.elements.body.querySelector(`.hud-keycap[data-code="${SAME_CAP[code] ?? code}"]`)
    key?.classList.toggle('is-pressed', pressed)
  }
}

function groupElement(group: ControlGroup): HTMLElement {
  const element = Object.assign(document.createElement('div'), { className: 'hud-controls-group' })
  const caps = Object.assign(document.createElement('div'), { className: 'hud-controls-caps' })
  if (group.keys.length > 0) caps.append(...group.keys.map(rowElement))
  else caps.append(...group.gestures.map((name) => Object.assign(document.createElement('span'), { className: 'hud-gesturecap', textContent: name })))
  element.append(caps, Object.assign(document.createElement('span'), { className: 'hud-controls-caption', textContent: group.caption }))
  return element
}

function rowElement(row: (KeyCap | null)[]): HTMLElement {
  const element = Object.assign(document.createElement('div'), { className: 'hud-controls-row' })
  element.append(...row.map(keyElement))
  return element
}

function keyElement(key: KeyCap | null): HTMLElement {
  if (!key) return Object.assign(document.createElement('span'), { className: 'hud-keycap is-gap' })
  const element = Object.assign(document.createElement('kbd'), { className: key.wide ? 'hud-keycap is-wide' : 'hud-keycap', textContent: key.label })
  element.dataset.code = key.code
  return element
}
