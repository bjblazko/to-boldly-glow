import { GRAND_TOUR } from '../camera/tour/grandTour'

export interface GrandTourParts {
  narrator: { readonly stopIndex: number; seek(stop: number): void; setPaused(paused: boolean): void }
  itinerary: { seek(stop: number): void }
  tour: { redirect(): void; setPaused(paused: boolean): void }
  clock: { isPaused(): boolean; pause(): void; play(): void }
}

// The grand tour's back, next and pause: the route, the narrator and the ship skip together, and a
// pause holds the ship, the voice and the clock (one the user had paused stays paused).
export class GrandTourRemote {
  private held: { clockWasPaused: boolean } | null = null

  constructor(private readonly parts: GrandTourParts) {}

  get paused(): boolean {
    return this.held !== null
  }

  get canGoBack(): boolean {
    return this.parts.narrator.stopIndex > 0
  }

  get canGoOn(): boolean {
    return this.parts.narrator.stopIndex < GRAND_TOUR.length - 1
  }

  previous(): void {
    if (this.canGoBack) this.goTo(this.parts.narrator.stopIndex - 1)
  }

  next(): void {
    if (this.canGoOn) this.goTo(this.parts.narrator.stopIndex + 1)
  }

  togglePause(): void {
    if (this.held) return this.carryOn()
    const { clock, tour, narrator } = this.parts
    this.held = { clockWasPaused: clock.isPaused() }
    clock.pause()
    tour.setPaused(true)
    narrator.setPaused(true)
  }

  private carryOn(): void {
    const { clock, tour, narrator } = this.parts
    if (!this.held?.clockWasPaused) clock.play()
    this.held = null
    tour.setPaused(false)
    narrator.setPaused(false)
  }

  private goTo(stop: number): void {
    if (this.held) this.carryOn()
    this.parts.itinerary.seek(stop)
    this.parts.narrator.seek(stop)
    this.parts.tour.redirect()
  }
}
