// How long the first picture stays still before the tour sets off.
export const STARTUP_TOUR_DELAY_MS = 2000

const USER_INPUT_EVENTS = ['pointerdown', 'wheel', 'keydown'] as const

// Starts the planet tour a moment after the scene first shows - unless the user moves first (a
// press, a scroll, a key), or by then is in a lesson or following a body (`isAllowed`).
export function scheduleStartupTour(start: () => void, isAllowed: () => boolean, input: EventTarget): void {
  const cancel = () => {
    clearTimeout(timer)
    USER_INPUT_EVENTS.forEach((type) => input.removeEventListener(type, cancel, true))
  }
  const timer = setTimeout(() => {
    cancel()
    if (isAllowed()) start()
  }, STARTUP_TOUR_DELAY_MS)
  USER_INPUT_EVENTS.forEach((type) => input.addEventListener(type, cancel, true))
}

// A link (and the end-to-end tests) can ask for a still start with ?tour=off.
export function startupTourWanted(search: string): boolean {
  return new URLSearchParams(search).get('tour') !== 'off'
}
