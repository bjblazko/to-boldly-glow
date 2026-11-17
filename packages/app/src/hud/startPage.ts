import { bindLanguageSwitch } from './languageSwitch'
import { bindVoiceSwitch } from '../narration/narratorVoice'

export interface StartPageElements {
  dialog: HTMLElement
  // The bar's Start button.
  opener: HTMLButtonElement
  close: HTMLButtonElement
  grand: HTMLButtonElement
  explore: HTMLButtonElement
  language: HTMLElement
  voice: HTMLElement
}

export interface StartPageActions {
  // The narrated grand tour - started by the click on Start, which lets the browser play its voice.
  startGrandTour(): void
  // Exploring on one's own: whatever runs ends.
  exploreOnOwn(): void
  // Before it opens: the other menus close, and the lesson cards show where each was left.
  opening(): void
}

// The start page: the grand tour (with the language and narrator to pick), the mission tours, the
// lessons, and exploring on one's own. The bar's Start button opens and closes it; its close button,
// Escape or a press outside it put it away. Picking anything closes it.
export class StartPage {
  constructor(
    private readonly elements: StartPageElements,
    private readonly actions: StartPageActions,
  ) {
    bindLanguageSwitch(elements.language)
    bindVoiceSwitch(elements.voice)
    elements.opener.addEventListener('click', () => (this.isOpen ? this.close() : this.open()))
    elements.close.addEventListener('click', () => this.close(true))
    elements.grand.addEventListener('click', () => this.pick(() => actions.startGrandTour()))
    elements.explore.addEventListener('click', () => this.pick(() => actions.exploreOnOwn()))
    // Escape here first (capturing), so it closes only the start page, not a tour running under it.
    window.addEventListener('keydown', this.onEscape, true)
    window.addEventListener('pointerdown', this.onPressOutside, true)
  }

  get isOpen(): boolean {
    return !this.elements.dialog.hidden
  }

  open(): void {
    this.actions.opening()
    this.elements.dialog.hidden = false
    this.elements.opener.setAttribute('aria-expanded', 'true')
    this.elements.opener.classList.add('is-active')
    this.elements.grand.focus({ preventScroll: true })
  }

  close(returnFocus = false): void {
    if (!this.isOpen) return
    this.elements.dialog.hidden = true
    this.elements.opener.setAttribute('aria-expanded', 'false')
    this.elements.opener.classList.remove('is-active')
    if (returnFocus) this.elements.opener.focus()
  }

  // Closes, then does what was picked (a lesson or tour card goes through here too).
  pick(action: () => void): void {
    this.close()
    action()
  }

  private onEscape = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !this.isOpen) return
    event.stopPropagation()
    this.close(true)
  }

  private onPressOutside = (event: PointerEvent) => {
    const target = event.target as Node | null
    if (this.isOpen && !this.elements.dialog.contains(target) && !this.elements.opener.contains(target)) this.close()
  }
}
