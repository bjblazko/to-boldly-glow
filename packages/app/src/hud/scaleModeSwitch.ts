import { EasedTween } from '../math/easedTween'

const REALISTIC = 0
const COMPACT = 1

// The Realistic/Compact scale switch: a pair of buttons, each asserting its own mode (with
// aria-pressed saying which is active) rather than one ambiguous checkbox. The scene's scale blend
// eases between the two over a moment, so bodies and orbits visibly grow or shrink together.
export class ScaleModeSwitch {
  // Starts Compact: at Realistic scale the inner planets are indistinguishable from the Sun.
  blend = COMPACT
  private readonly tween = new EasedTween(COMPACT)

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly buttons: { realistic: HTMLButtonElement; compact: HTMLButtonElement },
  ) {
    buttons.realistic.addEventListener('click', () => this.select(REALISTIC))
    buttons.compact.addEventListener('click', () => this.select(COMPACT))
    canvas.dataset.scaleMode = 'compact'
  }

  // Advances the transition; true when the blend changed this frame.
  update(deltaSeconds: number): boolean {
    if (!this.tween.isAnimating) return false
    this.blend = this.tween.update(deltaSeconds)
    this.canvas.dataset.scaleBlend = String(this.blend)
    if (!this.tween.isAnimating) this.canvas.dataset.scaleMode = this.tween.target === COMPACT ? 'compact' : 'realistic'
    return true
  }

  private select(target: number): void {
    this.tween.retarget(target, this.blend)
    this.buttons.realistic.setAttribute('aria-pressed', String(target === REALISTIC))
    this.buttons.compact.setAttribute('aria-pressed', String(target === COMPACT))
  }
}
