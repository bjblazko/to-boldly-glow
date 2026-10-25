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
// Done with a stop, the narrator waits for the ship to set off for the next one. Where that takes
// long - the Sun's wide loop can take nearly another lap to head for Mercury - it turns to the next
// stop after this much quiet anyway, rather than in a silence that sounds like the end.
const NEXT_STOP_PAUSE_MS = 5000
const SUBTITLE_TICK_MS = 200

interface Queued {
  leg: number
  part: NarrationPart
  clip: NarrationClip
}

// The grand tour's guide: it tells the ship how long to take at each stop (the length of what
// there is to say), speaks the approach on the way and the rest while circling, and holds the ship
// at a stop until it has finished.
export class Narrator implements TourPacing, TourListener {
  private legsStarted = 0
  private readonly queue: Queued[] = []
  private playing: (Queued & { cues: SubtitleCue[] }) | null = null
  private readonly spoken = new Set<string>()
  private ticker: ReturnType<typeof setInterval> | undefined
  private nextStopTimer: ReturnType<typeof setTimeout> | undefined

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

  // The approach may already be spoken (see NEXT_STOP_PAUSE_MS); then it isn't again.
  onLegStart(): void {
    this.legsStarted++
    clearTimeout(this.nextStopTimer)
    this.enqueue(this.legsStarted - 1, 'approach')
  }

  onLoopEnter(): void {
    this.enqueue(this.legsStarted - 1, 'orbit')
  }

  // The tour was stopped (or left): silence.
  stop(): void {
    clearTimeout(this.nextStopTimer)
    this.queue.length = 0
    this.playing = null
    this.player.stop()
    clearInterval(this.ticker)
    this.ticker = undefined
    this.view.show(null)
  }

  private enqueue(leg: number, part: NarrationPart): void {
    const stop = GRAND_TOUR[leg]?.stop
    const already = (entry: { leg: number; part: NarrationPart } | null) => entry?.leg === leg && entry.part === part
    if (!stop || this.spoken.has(key(leg, part)) || already(this.playing) || this.queue.some(already)) return
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
      if (next.part === 'orbit') this.nextStopTimer = setTimeout(() => this.enqueue(next.leg + 1, 'approach'), NEXT_STOP_PAUSE_MS)
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
