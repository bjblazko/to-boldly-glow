import { msg } from '../i18n/i18n'

export type TourId = 'grand' | 'voyager1' | 'voyager2' | 'apollo11'

// The tours the start page offers as cards (the grand tour has its own place at the top).
const MISSION_TOURS = ['voyager1', 'voyager2', 'apollo11'] as const

// The mission tours on the start page, one card each - like the lessons, for flights the narrator
// guides.
export function renderTourCards(list: HTMLElement, onPick: (tour: TourId) => void): void {
  list.replaceChildren(...MISSION_TOURS.map((tour) => tourCard(tour, onPick)))
}

function tourCard(tour: (typeof MISSION_TOURS)[number], onPick: (tour: TourId) => void): HTMLButtonElement {
  const { title, meta } = msg.missions[tour]
  const card = document.createElement('button')
  card.type = 'button'
  card.className = 'hud-lesson-card'
  card.dataset.tourId = tour
  card.append(
    Object.assign(document.createElement('span'), { className: 'hud-lesson-card-title', textContent: title }),
    Object.assign(document.createElement('span'), { className: 'hud-lesson-card-meta', textContent: meta }),
  )
  card.addEventListener('click', () => onPick(tour))
  return card
}
