import type { AudioClipPlayer } from './audioClipPlayer'
import type { NarrationView } from './narrator'

const SUBTITLES_KEY = 'toBoldlyGlow.subtitles'
const SOUND_KEY = 'toBoldlyGlow.narrationSound'

export interface NarrationBarElements {
  bar: HTMLElement
  subtitle: HTMLElement
  subtitlesToggle: HTMLInputElement
  soundToggle: HTMLInputElement
}

// Under the scene while the narrated tour runs: the narrator's subtitles. Settings switch them on
// (they start off) and the narrator's sound off; both are remembered in the browser.
export class NarrationBar implements NarrationView {
  constructor(
    private readonly elements: NarrationBarElements,
    player: AudioClipPlayer,
  ) {
    const { subtitle, subtitlesToggle, soundToggle } = elements
    bindSwitch(subtitlesToggle, SUBTITLES_KEY, false, (on) => (subtitle.hidden = !on))
    bindSwitch(soundToggle, SOUND_KEY, true, (on) => (player.muted = !on))
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
}

// A checkbox whose state is remembered under `key`, applied now and on every change.
function bindSwitch(toggle: HTMLInputElement, key: string, fallback: boolean, apply: (on: boolean) => void): void {
  toggle.checked = readSetting(key, fallback)
  apply(toggle.checked)
  toggle.addEventListener('change', () => {
    writeSetting(key, toggle.checked)
    apply(toggle.checked)
  })
}

function readSetting(key: string, fallback: boolean): boolean {
  try {
    const stored = localStorage.getItem(key)
    return stored === null ? fallback : stored === 'on'
  } catch {
    return fallback
  }
}

function writeSetting(key: string, on: boolean): void {
  try {
    localStorage.setItem(key, on ? 'on' : 'off')
  } catch {
    // Blocked storage: the setting holds for this page only.
  }
}
