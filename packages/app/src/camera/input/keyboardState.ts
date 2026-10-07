const NON_TEXT_INPUT_TYPES = new Set(['button', 'checkbox', 'radio', 'submit', 'reset', 'image', 'color', 'file'])

// True when a key event is aimed at a control that consumes typing or arrow keys itself (the
// search box, the time-shuttle range slider, a <select>) - those keys belong to that control, not
// to the camera.
export function isTextEntryTarget(target: EventTarget | null): boolean {
  if (typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true
  return target instanceof HTMLInputElement && !NON_TEXT_INPUT_TYPES.has(target.type)
}

// Which keys are held right now (by KeyboardEvent.code).
export class KeyboardState {
  private readonly pressed = new Set<string>()

  constructor(isEnabled: () => boolean) {
    window.addEventListener('keydown', (event) => {
      // Typing "was" into the search box, or arrowing the time-shuttle slider, must not also steer.
      if (isEnabled() && !isTextEntryTarget(event.target)) this.pressed.add(event.code)
    })
    window.addEventListener('keyup', (event) => this.pressed.delete(event.code))
    // A key released while the window doesn't have focus (alt-tab, a dialog) never delivers its
    // keyup here, which would leave the ship accelerating on its own.
    window.addEventListener('blur', () => this.pressed.clear())
  }

  isDown(...codes: string[]): boolean {
    return codes.some((code) => this.pressed.has(code))
  }

  // +1 while only a positive key is held, -1 for only a negative one, 0 for neither or both.
  axis(positive: string[], negative: string[]): number {
    return Number(this.isDown(...positive)) - Number(this.isDown(...negative))
  }

  clear(): void {
    this.pressed.clear()
  }
}
