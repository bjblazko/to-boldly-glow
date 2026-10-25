// The two narrators, named for constellations: Lyra and Orion. Each speaks every language; the
// choice is offered on the welcome card and in Settings, and remembered in the browser.
export const NARRATOR_VOICES = ['lyra', 'orion'] as const
export type NarratorVoice = (typeof NARRATOR_VOICES)[number]

export const VOICE_NAMES: Record<NarratorVoice, string> = { lyra: 'Lyra', orion: 'Orion' }

const STORAGE_KEY = 'toBoldlyGlow.voice'
const DEFAULT_VOICE: NarratorVoice = 'lyra'

let chosen: NarratorVoice = readVoice()
const switches = new Set<HTMLElement>()

export function narratorVoice(): NarratorVoice {
  return chosen
}

// A row of buttons, one per narrator; every row on the page shows the same choice.
export function bindVoiceSwitch(container: HTMLElement): void {
  switches.add(container)
  container.replaceChildren(
    ...NARRATOR_VOICES.map((voice) => {
      const button = Object.assign(document.createElement('button'), { type: 'button', className: 'hud-segmented-btn', textContent: VOICE_NAMES[voice] })
      button.dataset.voice = voice
      button.addEventListener('click', () => chooseVoice(voice))
      return button
    }),
  )
  showChoice(container)
}

export function chooseVoice(voice: NarratorVoice): void {
  chosen = voice
  try {
    localStorage.setItem(STORAGE_KEY, voice)
  } catch {
    // Blocked storage: the choice holds for this page only.
  }
  switches.forEach(showChoice)
}

function showChoice(container: HTMLElement): void {
  for (const button of container.querySelectorAll<HTMLButtonElement>('button[data-voice]')) {
    button.setAttribute('aria-pressed', String(button.dataset.voice === chosen))
  }
}

function readVoice(): NarratorVoice {
  try {
    const stored = typeof localStorage === 'undefined' ? null : localStorage.getItem(STORAGE_KEY)
    return (NARRATOR_VOICES as readonly string[]).includes(stored ?? '') ? (stored as NarratorVoice) : DEFAULT_VOICE
  } catch {
    return DEFAULT_VOICE
  }
}
