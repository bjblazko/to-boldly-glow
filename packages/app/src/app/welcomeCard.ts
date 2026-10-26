import { bindLanguageSwitch } from '../hud/languageSwitch'
import { bindVoiceSwitch } from '../narration/narratorVoice'
import { scheduleStartupTour } from './startupTour'

export interface WelcomeCardElements {
  card: HTMLElement
  close: HTMLButtonElement
  language: HTMLElement
  voice: HTMLElement
  start: HTMLButtonElement
  explore: HTMLButtonElement
  // The card shrunk out of the way: Start, and a close button.
  pill: HTMLElement
  pillStart: HTMLButtonElement
  pillClose: HTMLButtonElement
  // The dock's own tour button: once it is used, neither card nor pill is needed.
  tourToggle: HTMLElement
}

export interface WelcomeActions {
  // The narrated tour - started by the click on Start, which lets the browser play its sound.
  startNarratedTour(): void
  // The silent endless loop, when nobody has touched anything for a while.
  startIdleTour(): void
  // The visitor chose to explore on their own: the orbit paths and labels that help find the way.
  exploreOnOwn(): void
  // Whether the idle tour may still start (not in a lesson, not following a body).
  idleTourAllowed(): boolean
}

const OUTSIDE_EVENTS = ['pointerdown', 'wheel'] as const

// What a visitor sees first: the language (asked here, the first time) and the narrator's voice,
// Start for the narrated tour, or Explore on their own. Left alone, the card steps aside and the
// silent tour sets off. Used elsewhere first - a dock, the scene - it shrinks to a small Start
// pill, so the view can be set up before the tour; its close button or Escape puts it away.
export function showWelcomeCard(elements: WelcomeCardElements, actions: WelcomeActions, input: EventTarget): void {
  const { card, language, voice, pill } = elements
  bindLanguageSwitch(language)
  bindVoiceSwitch(voice)
  card.hidden = false
  const shrink = (event: Event) => {
    const target = event.target as Node
    if (card.hidden || card.contains(target) || pill.contains(target)) return
    card.hidden = true
    pill.hidden = false
  }
  const dismiss = () => {
    card.hidden = true
    pill.hidden = true
    window.removeEventListener('keydown', onEscape)
    OUTSIDE_EVENTS.forEach((type) => window.removeEventListener(type, shrink, true))
  }
  const onEscape = (event: KeyboardEvent) => {
    if (event.key === 'Escape') dismiss()
  }
  window.addEventListener('keydown', onEscape)
  OUTSIDE_EVENTS.forEach((type) => window.addEventListener(type, shrink, true))
  bindButtons(elements, actions, dismiss)
  elements.start.focus({ preventScroll: true })
  scheduleStartupTour(
    () => {
      dismiss()
      actions.startIdleTour()
    },
    () => !card.hidden && actions.idleTourAllowed(),
    input,
  )
}

function bindButtons(elements: WelcomeCardElements, actions: WelcomeActions, dismiss: () => void): void {
  const startTour = () => {
    dismiss()
    actions.startNarratedTour()
  }
  elements.start.addEventListener('click', startTour)
  elements.pillStart.addEventListener('click', startTour)
  elements.explore.addEventListener('click', () => {
    dismiss()
    actions.exploreOnOwn()
  })
  elements.close.addEventListener('click', dismiss)
  elements.pillClose.addEventListener('click', dismiss)
  elements.tourToggle.addEventListener('click', dismiss)
}
