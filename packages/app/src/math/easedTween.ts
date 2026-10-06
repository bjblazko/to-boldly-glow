import { easeInOutCubic, lerp } from './easing'

// Eases a number from its current value to a target over a fixed duration (ease-in-out cubic).
export class EasedTween {
  private start: number
  private end: number
  private elapsedSeconds: number

  constructor(
    initial: number,
    private readonly durationSeconds = 1.5,
  ) {
    this.start = initial
    this.end = initial
    this.elapsedSeconds = durationSeconds
  }

  // Re-targets the tween toward `newEnd`, capturing `currentValue` as the new start so flipping
  // the toggle again mid-animation continues smoothly from wherever the value actually is, rather
  // than jumping back to the previous start.
  retarget(newEnd: number, currentValue: number): void {
    this.start = currentValue
    this.end = newEnd
    this.elapsedSeconds = 0
  }

  // Advances the tween by `deltaSeconds` and returns the eased current value. Callers should only
  // invoke this while `isAnimating` is true.
  update(deltaSeconds: number): number {
    this.elapsedSeconds = Math.min(this.elapsedSeconds + deltaSeconds, this.durationSeconds)
    const t = this.durationSeconds > 0 ? this.elapsedSeconds / this.durationSeconds : 1
    return lerp(this.start, this.end, easeInOutCubic(t))
  }

  get target(): number {
    return this.end
  }

  get isAnimating(): boolean {
    return this.elapsedSeconds < this.durationSeconds
  }
}
