import { bindLanguageSwitch } from '../hud/languageSwitch'
import { bindVoiceSwitch } from '../narration/narratorVoice'
import { scheduleStartupTour } from './startupTour'

export interface WelcomeCardElements {
  card: HTMLElement
  language: HTMLElement
  voice: HTMLElement
  start: HTMLButtonElement
  explore: HTMLButtonElement
}

export interface WelcomeActions {
  // The narrated tour - started by the click on Start, which lets the browser play its sound.
  startNarratedTour(): void
  // The silent endless loop, when nobody has touched anything for a while.
  startIdleTour(): void
  // Whether the idle tour may still start (not in a lesson, not following a body).
  idleTourAllowed(): boolean
}

// What a visitor sees first: the language (asked here, the first time) and the narrator's voice,
// Start for the narrated tour, or Explore on their own. Left alone, the card steps aside and the
// silent tour sets off.
export function showWelcomeCard(elements: WelcomeCardElements, actions: WelcomeActions, input: EventTarget): void {
  const { card, language, voice, start, explore } = elements
  bindLanguageSwitch(language)
  bindVoiceSwitch(voice)
  card.hidden = false
  const close = () => {
    card.hidden = true
    window.removeEventListener('keydown', onEscape)
  }
  const onEscape = (event: KeyboardEvent) => {
    if (event.key === 'Escape') close()
  }
  window.addEventListener('keydown', onEscape)
  start.addEventListener('click', () => {
    close()
    actions.startNarratedTour()
  })
  explore.addEventListener('click', close)
  start.focus({ preventScroll: true })
  scheduleStartupTour(
    () => {
      close()
      actions.startIdleTour()
    },
    () => !card.hidden && actions.idleTourAllowed(),
    input,
  )
}
