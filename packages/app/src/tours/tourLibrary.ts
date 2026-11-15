import { msg } from '../i18n/i18n'

export interface TourLibraryElements {
  dialog: HTMLElement
  list: HTMLElement
  closeButton: HTMLButtonElement
}

export type TourId = 'grand' | 'voyager1' | 'voyager2'

const TOURS: readonly TourId[] = ['grand', 'voyager1', 'voyager2']

// A tour's card: the grand tour's words, or a mission's.
function cardText(tour: TourId): { title: string; meta: string } {
  return tour === 'grand' ? msg.ui.tours.grand : msg.missions[tour]
}

// The tours on offer, one card each - like the lesson library, for flights the narrator guides.
export class TourLibrary {
  constructor(
    private readonly elements: TourLibraryElements,
    private readonly handlers: { onPick(tour: TourId): void; onClose(): void },
  ) {
    elements.closeButton.addEventListener('click', () => handlers.onClose())
    elements.list.replaceChildren(...TOURS.map((tour) => this.card(tour)))
  }

  get isOpen(): boolean {
    return !this.elements.dialog.hidden
  }

  open(): void {
    this.elements.dialog.hidden = false
    this.elements.list.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true })
  }

  close(): void {
    this.elements.dialog.hidden = true
  }

  private card(tour: TourId): HTMLButtonElement {
    const { title, meta } = cardText(tour)
    const card = document.createElement('button')
    card.type = 'button'
    card.className = 'hud-lesson-card'
    card.dataset.tourId = tour
    card.append(
      Object.assign(document.createElement('span'), { className: 'hud-lesson-card-title', textContent: title }),
      Object.assign(document.createElement('span'), { className: 'hud-lesson-card-meta', textContent: meta }),
    )
    card.addEventListener('click', () => this.handlers.onPick(tour))
    return card
  }
}
