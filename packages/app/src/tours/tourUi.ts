import type { ModeButtons } from '../hud/modeButtons'
import { TourLibrary, type TourId, type TourLibraryElements } from './tourLibrary'

export interface TourUiElements {
  exploreButton: HTMLButtonElement
  learnButton: HTMLButtonElement
  toursButton: HTMLButtonElement
  library: TourLibraryElements
}

export interface TourActions {
  // Closes the other menus (the lesson library, a dock panel) before the tour library opens.
  closeOtherMenus(): void
  // Leaves a running lesson first (and closes its library).
  leaveLesson(): void
  startTour(tour: TourId): void
  stopTour(): void
}

// The Tours mode: its button opens the tour library, a card there starts that tour (out of a lesson,
// if one runs), and Explore stops it. Tours reads as on while the library is open or a narrated
// tour flies (see narratedTourChanged).
export class TourUi {
  private readonly library: TourLibrary
  private narrated = false

  constructor(
    elements: TourUiElements,
    private readonly actions: TourActions,
    private readonly modes: ModeButtons,
  ) {
    this.library = new TourLibrary(elements.library, { onPick: (tour) => this.start(tour), onClose: () => this.closeLibrary() })
    elements.toursButton.addEventListener('click', () => (this.library.isOpen ? this.closeLibrary() : this.openLibrary()))
    elements.exploreButton.addEventListener('click', () => this.explore())
    elements.learnButton.addEventListener('click', () => this.closeLibrary())
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.library.isOpen) this.closeLibrary()
    })
  }

  narratedTourChanged(flying: boolean): void {
    this.narrated = flying
    this.refresh()
  }

  private start(tour: TourId): void {
    this.library.close()
    this.actions.leaveLesson()
    this.actions.startTour(tour)
    this.refresh()
  }

  private explore(): void {
    this.library.close()
    if (this.narrated) this.actions.stopTour()
    this.refresh()
  }

  private openLibrary(): void {
    this.actions.closeOtherMenus()
    this.library.open()
    this.refresh()
  }

  private closeLibrary(): void {
    this.library.close()
    this.refresh()
  }

  private refresh(): void {
    this.modes.setTouring(this.library.isOpen || this.narrated)
  }
}
