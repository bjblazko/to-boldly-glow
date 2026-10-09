// How often the readout changes: often enough to follow a stutter, slow enough to read.
const SAMPLE_SECONDS = 0.5

// Counts frames and turns them into frames per second, averaged over each half second.
export class FrameRate {
  private frames = 0
  private seconds = 0
  private latest: number | null = null

  // Adds one frame that took `deltaSeconds`; true when a new reading is ready.
  addFrame(deltaSeconds: number): boolean {
    this.frames++
    this.seconds += deltaSeconds
    if (this.seconds < SAMPLE_SECONDS) return false
    this.latest = this.frames / this.seconds
    this.frames = 0
    this.seconds = 0
    return true
  }

  get perSecond(): number | null {
    return this.latest
  }
}

// The Settings panel's frame-rate readout, in the scene's lower left corner while it is switched on.
export class FpsMeter {
  private readonly rate = new FrameRate()

  constructor(
    private readonly display: HTMLElement,
    private readonly isOn: () => boolean,
  ) {}

  frame(realDeltaSeconds: number): void {
    const on = this.isOn()
    this.display.hidden = !on
    if (!this.rate.addFrame(realDeltaSeconds) || !on) return
    this.display.textContent = `${Math.round(this.rate.perSecond ?? 0)} fps`
  }
}
