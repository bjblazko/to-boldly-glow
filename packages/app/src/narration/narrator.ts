import { GRAND_TOUR } from '../camera/tour/grandTour'
import type { LegPace } from '../camera/tour/tourLeg'
import type { TourListener, TourPacing } from '../camera/tourController'
import type { NarrationPart, NarrationStop } from './scripts/en'
import { cueAt, subtitleCues, type SubtitleCue } from './subtitles'

export interface NarrationClip {
  text: string
  seconds: number
  // The audio, or null to narrate by subtitles alone.
  url: string | null
}

// Plays one clip at a time and says when it has ended.
export interface ClipPlayer {
  play(clip: NarrationClip, onEnded: () => void): void
  // Fetches a clip ahead, so it starts at once when its turn comes.
  prefetch?(clip: NarrationClip): void
  // Seconds into the clip playing.
  elapsed(): number
  // Whether the clip playing is still waiting for its download.
  readonly isLoading?: boolean
  stop(): void
  // Holds the clip where it is, and carries on from there.
  pause(): void
  resume(): void
}

export interface NarrationView {
  // The subtitle to show now, or null for none.
  show(text: string | null): void
}

// A clip is a bit shorter than the time the ship should take for it: it arrives, and leaves, with
// a moment of quiet.
const TRANSIT_MARGIN_SECONDS = 3
const LAP_MARGIN_SECONDS = 6
const SUBTITLE_TICK_MS = 200

interface Queued {
  leg: number
  part: NarrationPart
  clip: NarrationClip
}

// The grand tour's guide: it tells the ship how long to take at each stop (the length of what
// there is to say), speaks the approach as the ship nears it and the rest while circling, and holds
// the ship at a stop until it has finished.
export class Narrator implements TourPacing, TourListener {
  private legsStarted = 0
  private readonly queue: Queued[] = []
  private playing: (Queued & { cues: SubtitleCue[] }) | null = null
  private readonly spoken = new Set<string>()
  private ticker: ReturnType<typeof setInterval> | undefined

  constructor(
    private readonly clipFor: (stop: NarrationStop, part: NarrationPart) => NarrationClip,
    private readonly player: ClipPlayer,
    private readonly view: NarrationView,
  ) {}

  // Asked as each leg is planned, just before it starts: its clips, and the next stop's, are fetched
  // ahead.
  pace(): LegPace {
    const stop = GRAND_TOUR[this.legsStarted]?.stop
    if (!stop) return { transitSeconds: 0, lapSeconds: 0 }
    this.prefetchStop(this.legsStarted)
    this.prefetchStop(this.legsStarted + 1)
    return {
      transitSeconds: this.clipFor(stop, 'approach').seconds + TRANSIT_MARGIN_SECONDS,
      lapSeconds: this.clipFor(stop, 'orbit').seconds + LAP_MARGIN_SECONDS,
    }
  }

  mayDepart(): boolean {
    return this.spoken.has(key(this.legsStarted - 1, 'orbit'))
  }

  onLegStart(): void {
    this.legsStarted++
  }

  // Timed by the ship so the approach ends about as it arrives.
  onApproach(): void {
    this.enqueue(this.legsStarted - 1, 'approach')
  }

  onLoopEnter(): void {
    this.enqueue(this.legsStarted - 1, 'orbit')
  }

  // Which stop of GRAND_TOUR the tour is at, or heading for.
  get stopIndex(): number {
    return this.legsStarted - 1
  }

  // The tour skips to another stop (its next leg starts there): what was said of it, and after it,
  // is said again.
  seek(stop: number): void {
    this.stop()
    this.legsStarted = stop
    for (const spoken of [...this.spoken]) if (Number(spoken.split('-')[0]) >= stop) this.spoken.delete(spoken)
  }

  setPaused(paused: boolean): void {
    if (paused) this.player.pause()
    else this.player.resume()
  }

  // The tour was stopped (or left): silence.
  stop(): void {
    this.queue.length = 0
    this.playing = null
    this.player.stop()
    clearInterval(this.ticker)
    this.ticker = undefined
    this.view.show(null)
  }

  private prefetchStop(leg: number): void {
    const stop = GRAND_TOUR[leg]?.stop
    if (!stop || !this.player.prefetch) return
    for (const part of ['approach', 'orbit'] as const) this.player.prefetch(this.clipFor(stop, part))
  }

  private enqueue(leg: number, part: NarrationPart): void {
    const stop = GRAND_TOUR[leg]?.stop
    if (!stop || this.spoken.has(key(leg, part))) return
    this.queue.push({ leg, part, clip: this.clipFor(stop, part) })
    if (!this.playing) this.playNext()
  }

  private playNext(): void {
    const next = this.queue.shift()
    if (!next) {
      this.playing = null
      clearInterval(this.ticker)
      this.ticker = undefined
      this.view.show(null)
      return
    }
    const playing = { ...next, cues: subtitleCues(next.clip.text, next.clip.seconds) }
    this.playing = playing
    this.player.play(next.clip, () => {
      if (this.playing !== playing) return
      this.spoken.add(key(next.leg, next.part))
      this.playNext()
    })
    this.ticker ??= setInterval(() => this.showSubtitle(), SUBTITLE_TICK_MS)
    this.showSubtitle()
  }

  private showSubtitle(): void {
    if (this.playing) this.view.show(cueAt(this.playing.cues, this.player.elapsed())?.text ?? null)
  }
}

function key(leg: number, part: NarrationPart): string {
  return `${leg}-${part}`
}
