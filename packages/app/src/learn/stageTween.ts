import { EasedTween } from '../math/easedTween'

// A lesson stage's numbers, each eased from one chapter's value to the next over the same time.
export class StageTween<Key extends string> {
  private readonly tweens: Record<Key, EasedTween>
  readonly current: Record<Key, number>

  constructor(
    private readonly keys: readonly Key[],
    durationSeconds: number,
  ) {
    this.tweens = Object.fromEntries(keys.map((key) => [key, new EasedTween(0, durationSeconds)])) as Record<Key, EasedTween>
    this.current = Object.fromEntries(keys.map((key) => [key, 0])) as Record<Key, number>
  }

  get isAnimating(): boolean {
    return this.keys.some((key) => this.tweens[key].isAnimating)
  }

  moveTo(target: Record<Key, number>, snap: boolean): void {
    for (const key of this.keys) {
      this.tweens[key].retarget(target[key], snap ? target[key] : this.current[key])
      if (snap) this.current[key] = target[key]
    }
  }

  update(deltaSeconds: number): void {
    for (const key of this.keys) if (this.tweens[key].isAnimating) this.current[key] = this.tweens[key].update(deltaSeconds)
  }

  // Moves one value on its own (while its tween stands still), e.g. a Moon that keeps circling.
  advance(key: Key, delta: number): void {
    if (!this.tweens[key].isAnimating) this.current[key] += delta
  }
}
