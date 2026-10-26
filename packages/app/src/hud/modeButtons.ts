export type AppModeButton = 'explore' | 'learn' | 'tours'

// The top switch's buttons - Explore, Learn, Tours - showing which mode is on: Learn while its
// library is open or a lesson runs, Tours while its library is open or a narrated tour flies, and
// Explore otherwise. Learn wins if both are (opening a lesson ends the tour anyway).
export class ModeButtons {
  private learning = false
  private touring = false

  constructor(private readonly buttons: Record<AppModeButton, HTMLButtonElement>) {}

  setLearning(on: boolean): void {
    this.learning = on
    this.refresh()
  }

  setTouring(on: boolean): void {
    this.touring = on
    this.refresh()
  }

  private refresh(): void {
    const mode: AppModeButton = this.learning ? 'learn' : this.touring ? 'tours' : 'explore'
    for (const [name, button] of Object.entries(this.buttons)) {
      button.classList.toggle('is-active', name === mode)
      button.setAttribute('aria-pressed', String(name === mode))
    }
  }
}
