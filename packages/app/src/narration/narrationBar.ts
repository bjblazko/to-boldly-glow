import { msg } from '../i18n/i18n'
import type { AudioClipPlayer } from './audioClipPlayer'
import type { NarrationView } from './narrator'

const SUBTITLES_KEY = 'toBoldlyGlow.subtitles'

export interface NarrationBarElements {
  bar: HTMLElement
  subtitle: HTMLElement
  mute: HTMLButtonElement
  subtitlesToggle: HTMLInputElement
}

// Under the scene while the narrated tour runs: the narrator's subtitles (switchable in Settings,
// remembered in the browser) and a button to mute the narrator.
export class NarrationBar implements NarrationView {
  constructor(
    private readonly elements: NarrationBarElements,
    private readonly player: AudioClipPlayer,
  ) {
    elements.subtitlesToggle.checked = readSubtitlesSetting()
    elements.subtitlesToggle.addEventListener('change', () => {
      writeSubtitlesSetting(elements.subtitlesToggle.checked)
      elements.subtitle.hidden = !elements.subtitlesToggle.checked
    })
    elements.subtitle.hidden = !elements.subtitlesToggle.checked
    elements.mute.addEventListener('click', () => this.setMuted(!player.muted))
  }

  setActive(active: boolean): void {
    this.elements.bar.hidden = !active
    if (!active) this.show(null)
  }

  show(text: string | null): void {
    const { subtitle } = this.elements
    if (subtitle.textContent !== (text ?? '')) subtitle.textContent = text ?? ''
    subtitle.classList.toggle('is-empty', !text)
  }

  private setMuted(muted: boolean): void {
    this.player.muted = muted
    this.elements.mute.setAttribute('aria-pressed', String(muted))
    this.elements.mute.setAttribute('aria-label', muted ? msg.ui.narration.unmute : msg.ui.narration.mute)
  }
}

function readSubtitlesSetting(): boolean {
  try {
    return localStorage.getItem(SUBTITLES_KEY) !== 'off'
  } catch {
    return true
  }
}

function writeSubtitlesSetting(on: boolean): void {
  try {
    localStorage.setItem(SUBTITLES_KEY, on ? 'on' : 'off')
  } catch {
    // Blocked storage: the setting holds for this page only.
  }
}
