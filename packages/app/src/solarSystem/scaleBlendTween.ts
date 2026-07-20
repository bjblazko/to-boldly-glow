import { easeInOutCubic, lerp } from '../camera/easing'

// Animates scaleBlend between its Realistic (0) and Compact (1) endpoints when the scale toggle is
// flipped, rather than snapping instantly — the transition itself is what visually communicates
// relational distances (bodies/orbits smoothly growing or shrinking together) rather than just
// jumping between two disconnected views. Mirrors CameraFollowController's FlyToTween pattern
// (camera/cameraFollow.ts): store start/end plus elapsed/duration, ease per frame.
export class ScaleBlendTween {
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
