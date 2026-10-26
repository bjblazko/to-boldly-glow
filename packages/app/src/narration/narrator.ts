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
  // Seconds into the clip playing.
  elapsed(): number
  stop(): void
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

  // Asked as each leg is planned, just before it starts.
  pace(): LegPace {
    const stop = GRAND_TOUR[this.legsStarted]?.stop
    if (!stop) return { transitSeconds: 0, lapSeconds: 0 }
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

  // The tour was stopped (or left): silence.
  stop(): void {
    this.queue.length = 0
    this.playing = null
    this.player.stop()
    clearInterval(this.ticker)
    this.ticker = undefined
    this.view.show(null)
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
