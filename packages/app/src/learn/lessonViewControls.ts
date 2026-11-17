// The bar's "Reset view" in a lesson: back to the lesson's own view. Views from the ground stand at
// the observer's eye and can't be moved, so it switches off there.
export class LessonViewControls {
  constructor(
    private readonly reset: HTMLButtonElement,
    actions: { reset(): void },
  ) {
    reset.addEventListener('click', () => actions.reset())
  }

  setFixed(fixed: boolean): void {
    this.reset.disabled = fixed
  }
}
