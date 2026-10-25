import type { ClipPlayer, NarrationClip } from './narrator'

// Past a clip's length by this much, it counts as ended even if the audio never said so (a stalled
// download), so the tour can never hang on it.
const WATCHDOG_SLACK_SECONDS = 5

// Plays the narration through one audio element. Where it can't - no clip, a failed download, the
// browser refusing to play - the clip runs silently on a timer for its length, so the subtitles and
// the tour's pace stay the same.
export class AudioClipPlayer implements ClipPlayer {
  private readonly audio = new Audio()
  private startedAt = 0
  private clipSeconds = 0
  private silent = true
  private ended: (() => void) | null = null
  private watchdog: ReturnType<typeof setTimeout> | undefined

  constructor() {
    this.audio.preload = 'auto'
    this.audio.addEventListener('ended', () => this.finish())
    this.audio.addEventListener('error', () => this.goSilent())
  }

  get muted(): boolean {
    return this.audio.muted
  }

  set muted(muted: boolean) {
    this.audio.muted = muted
  }

  play(clip: NarrationClip, onEnded: () => void): void {
    this.stop()
    this.ended = onEnded
    this.startedAt = performance.now()
    this.clipSeconds = clip.seconds
    this.watchdog = setTimeout(() => this.finish(), (clip.seconds + WATCHDOG_SLACK_SECONDS) * 1000)
    this.silent = clip.url === null
    if (!clip.url) return this.endSilentlyAfter(clip.seconds)
    this.audio.src = clip.url
    this.audio.play().catch(() => this.goSilent())
  }

  elapsed(): number {
    return this.silent ? (performance.now() - this.startedAt) / 1000 : this.audio.currentTime
  }

  stop(): void {
    this.ended = null
    clearTimeout(this.watchdog)
    this.audio.pause()
  }

  // Carries on from where the clip was, on the timer.
  private goSilent(): void {
    if (this.silent || !this.ended) return
    this.silent = true
    this.endSilentlyAfter(this.clipSeconds)
  }

  private endSilentlyAfter(seconds: number): void {
    clearTimeout(this.watchdog)
    this.watchdog = setTimeout(() => this.finish(), Math.max(0, seconds - this.elapsed()) * 1000)
  }

  private finish(): void {
    const ended = this.ended
    this.stop()
    ended?.()
  }
}
