import type { ClipPlayer, NarrationClip } from './narrator'

// Past a clip's length by this much, it counts as ended even if the audio never said so, so the
// tour can never hang on it. Counted from when the voice is actually heard, not from when it was
// asked for: a clip still downloading must not be used up before it starts.
const WATCHDOG_SLACK_SECONDS = 5
// A clip that has not started (or stalls) for this long is given up: it runs on silently instead.
const LOADING_GIVE_UP_SECONDS = 20

// What the players tell the rest of the app: when the narrator is audible (the music steps back for
// it), and when a clip is waiting for its download (the voice status shows it). `source` is the
// player, so several players may each be loading.
export interface VoiceSignals {
  speaking(audible: boolean): void
  loading(source: object, waiting: boolean): void
}

const NO_SIGNALS: VoiceSignals = { speaking: () => {}, loading: () => {} }

// Plays the narration through one audio element. Where it can't - no clip, a failed or too slow
// download, the browser refusing to play - the clip runs silently on a timer for its length, so
// the subtitles and the tour's pace stay the same.
export class AudioClipPlayer implements ClipPlayer {
  private readonly audio = new Audio()
  private startedAt = 0
  private clipSeconds = 0
  private silent = true
  private ended: (() => void) | null = null
  private timer: ReturnType<typeof setTimeout> | undefined
  private loading = false
  // Seconds into the clip when it was paused, or null.
  private heldAt: number | null = null
  private readonly fetched = new Set<string>()

  constructor(private readonly signals: VoiceSignals = NO_SIGNALS) {
    this.audio.preload = 'auto'
    this.audio.addEventListener('ended', () => this.finish())
    this.audio.addEventListener('error', () => this.goSilent())
    this.audio.addEventListener('playing', () => this.heard())
    this.audio.addEventListener('waiting', () => this.waitForData())
  }

  get muted(): boolean {
    return this.audio.muted
  }

  // Switched off mid-clip, the clip runs on silently (and no longer waits for its download); switched
  // on, the voice comes back with the next clip.
  set muted(muted: boolean) {
    this.audio.muted = muted
    if (muted) this.goSilent()
  }

  play(clip: NarrationClip, onEnded: () => void): void {
    this.stop()
    this.ended = onEnded
    this.startedAt = performance.now()
    this.clipSeconds = clip.seconds
    // The narrator's voice switched off: nothing to fetch or wait for.
    const url = this.audio.muted ? null : clip.url
    this.silent = url === null
    if (url === null) return this.endSilentlyAfter(clip.seconds)
    this.fetched.add(url)
    this.audio.src = url
    this.waitForData()
    this.audio.play().catch(() => this.goSilent())
    this.signals.speaking(!this.audio.muted)
  }

  // Fetches a clip ahead into the browser's cache, so it starts at once when its turn comes.
  prefetch(clip: NarrationClip): void {
    if (!clip.url || this.audio.muted || this.fetched.has(clip.url) || !prefetchable(location.href)) return
    this.fetched.add(clip.url)
    fetch(clip.url, { priority: 'low' }).catch(() => this.fetched.delete(clip.url!))
  }

  // Whether the clip playing is still waiting for its download.
  get isLoading(): boolean {
    return this.loading
  }

  elapsed(): number {
    return this.silent ? (performance.now() - this.startedAt) / 1000 : this.audio.currentTime
  }

  pause(): void {
    if (!this.ended || this.heldAt !== null) return
    this.heldAt = this.elapsed()
    clearTimeout(this.timer)
    this.audio.pause()
    this.signals.speaking(false)
  }

  resume(): void {
    if (this.heldAt === null) return
    const at = this.heldAt
    this.heldAt = null
    if (!this.ended) return
    if (this.silent) {
      this.startedAt = performance.now() - at * 1000
      return this.endSilentlyAfter(this.clipSeconds)
    }
    this.audio.play().catch(() => this.goSilent())
    this.signals.speaking(!this.audio.muted)
  }

  stop(): void {
    this.heldAt = null
    this.ended = null
    clearTimeout(this.timer)
    this.audio.pause()
    this.setLoading(false)
    this.signals.speaking(false)
  }

  // Not heard yet (or stalled): hold the clip's end, and give up if it takes too long.
  private waitForData(): void {
    if (this.silent || !this.ended) return
    this.setLoading(true)
    clearTimeout(this.timer)
    this.timer = setTimeout(() => this.goSilent(), LOADING_GIVE_UP_SECONDS * 1000)
  }

  // The voice is heard: the clip ends with its audio, or at the latest a moment after its length.
  private heard(): void {
    if (this.silent || !this.ended) return
    this.setLoading(false)
    clearTimeout(this.timer)
    const remaining = Math.max(0, this.clipSeconds - this.audio.currentTime)
    this.timer = setTimeout(() => this.finish(), (remaining + WATCHDOG_SLACK_SECONDS) * 1000)
  }

  // Carries on from where the clip was, on the timer.
  private goSilent(): void {
    if (this.silent || !this.ended) return
    this.silent = true
    this.audio.pause()
    this.setLoading(false)
    this.signals.speaking(false)
    this.startedAt = performance.now() - this.audio.currentTime * 1000
    this.endSilentlyAfter(this.clipSeconds)
  }

  private endSilentlyAfter(seconds: number): void {
    clearTimeout(this.timer)
    this.timer = setTimeout(() => this.finish(), Math.max(0, seconds - this.elapsed()) * 1000)
  }

  private setLoading(waiting: boolean): void {
    if (waiting === this.loading) return
    this.loading = waiting
    this.signals.loading(this, waiting)
  }

  private finish(): void {
    const ended = this.ended
    this.stop()
    ended?.()
  }
}

// Whether clips can be fetched ahead: not in the download opened from the disk, where the browser
// lets an <audio> element play a file but not fetch() read it.
export function prefetchable(pageUrl: string): boolean {
  return new URL(pageUrl).protocol !== 'file:'
}
