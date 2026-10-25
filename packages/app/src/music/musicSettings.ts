import { msg } from '../i18n/i18n'
import type { MusicEngine } from './musicEngine'
import { MUSIC_TRACK_IDS, MUSIC_TRACKS, type MusicTrackId } from './musicTracks'

const TRACK_KEY = 'toBoldlyGlow.music'
const VOLUME_KEY = 'toBoldlyGlow.musicVolume'
const DEFAULT_VOLUME = 50

type MusicChoice = MusicTrackId | 'off'

// Settings' music controls: Off or one of the tracks, and a volume slider - both remembered in the
// browser. The music is off until chosen.
export function bindMusicSettings(trackSwitch: HTMLElement, volume: HTMLInputElement, engine: MusicEngine): void {
  const choices: MusicChoice[] = ['off', ...MUSIC_TRACK_IDS]
  let chosen = readChoice()
  const buttons = choices.map((choice) => {
    const button = Object.assign(document.createElement('button'), { type: 'button', className: 'hud-segmented-btn', textContent: choice === 'off' ? msg.ui.settings.musicOff : MUSIC_TRACKS[choice].name })
    button.dataset.music = choice
    button.addEventListener('click', () => {
      chosen = choice
      remember(TRACK_KEY, choice)
      show()
      engine.play(choice === 'off' ? null : MUSIC_TRACKS[choice])
    })
    return button
  })
  const show = () => buttons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.music === chosen)))
  trackSwitch.replaceChildren(...buttons)
  show()

  volume.value = String(readNumber(VOLUME_KEY, DEFAULT_VOLUME))
  const applyVolume = () => engine.setVolume(Number(volume.value) / 100)
  volume.addEventListener('input', () => {
    applyVolume()
    remember(VOLUME_KEY, volume.value)
  })
  applyVolume()
  if (chosen !== 'off') engine.play(MUSIC_TRACKS[chosen])
}

function readChoice(): MusicChoice {
  const stored = read(TRACK_KEY)
  return (MUSIC_TRACK_IDS as readonly string[]).includes(stored ?? '') ? (stored as MusicTrackId) : 'off'
}

function readNumber(key: string, fallback: number): number {
  const stored = Number(read(key) ?? NaN)
  return Number.isFinite(stored) ? Math.min(100, Math.max(0, stored)) : fallback
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function remember(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Blocked storage: the choice holds for this page only.
  }
}
