// The lesson scene's zoom in / zoom out / back-to-the-lesson's-view buttons. Views from the ground
// stand at the observer's eye and can't be moved, so the buttons switch off there.
export class LessonViewControls {
  private readonly buttons: HTMLButtonElement[]

  constructor(group: HTMLElement, actions: { zoom(logFactor: number): void; reset(): void }) {
    const find = (selector: string) => group.querySelector<HTMLButtonElement>(selector)
    const zoomIn = find('#lesson-zoom-in')
    const zoomOut = find('#lesson-zoom-out')
    const reset = find('#lesson-view-reset')
    zoomIn?.addEventListener('click', () => actions.zoom(-ZOOM_STEP))
    zoomOut?.addEventListener('click', () => actions.zoom(ZOOM_STEP))
    reset?.addEventListener('click', () => actions.reset())
    this.buttons = [zoomIn, zoomOut, reset].filter((button): button is HTMLButtonElement => button !== null)
  }

  setFixed(fixed: boolean): void {
    for (const button of this.buttons) button.disabled = fixed
  }
}

// One button press zooms by about 40%.
const ZOOM_STEP = 0.35
