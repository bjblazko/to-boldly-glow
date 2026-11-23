// The Apollo 11 tour's clock: which station the tour is at and the mission time (GET, s) shown.
// Each station has its stretch of the mission and its length in the tour. Inside a station's
// real-time windows the mission time runs at one second a second; the rest of its stretch is
// spread over the tour time left, the speed rising and falling smoothly between the windows. Between
// stations the picture fades out and in, and the mission time cuts to the next station's start.
// Pure: no DOM, no rendering.

export interface TourStation {
  id: string
  // Its stretch of the mission (GET, s).
  from: number
  to: number
  // Its length in the tour (s).
  seconds: number
  realTime?: { from: number; to: number }[]
}

export interface ClockMoment {
  stationIndex: number
  get: number
  // How dark the screen is (0 to 1), at the cut between stations.
  fade: number
  paused: boolean
  ended: boolean
}

export interface ClockListener {
  arrived(stationIndex: number): void
  ended(): void
}

export const FADE_SECONDS = 0.7

// A piece of a station: from `start` tour seconds into it, `seconds` long, covering GET `from` to
// `to` - at real time, or sped up (a cubic whose end speeds are `slope` of the piece's mean).
interface Piece {
  start: number
  seconds: number
  from: number
  to: number
  slope: number
}

// The fast stretches between the windows get the tour time left, each by its share of the GET.
function pieces(station: TourStation): Piece[] {
  const windows = (station.realTime ?? []).map((w) => ({ from: Math.max(w.from, station.from), to: Math.min(w.to, station.to) })).sort((a, b) => a.from - b.from)
  const spans: { from: number; to: number; real: boolean }[] = []
  let at = station.from
  for (const w of windows) {
    if (w.from > at) spans.push({ from: at, to: w.from, real: false })
    spans.push({ from: w.from, to: w.to, real: true })
    at = w.to
  }
  if (station.to > at) spans.push({ from: at, to: station.to, real: false })
  const real = windows.reduce((sum, w) => sum + (w.to - w.from), 0)
  const [fastGet, fastSeconds] = [station.to - station.from - real, station.seconds - real]
  let start = 0
  return spans.map((span) => {
    const length = span.to - span.from
    const seconds = span.real ? length : fastGet > 0 ? (fastSeconds * length) / fastGet : 0
    if (!span.real && seconds > length) throw new Error(`Apollo 11 tour: station ${station.id} would run slower than real time`)
    const piece = { start, seconds, from: span.from, to: span.to, slope: span.real || length === 0 ? 1 : seconds / length }
    start += seconds
    return piece
  })
}

function getIn(piece: Piece, t: number): number {
  const s = piece.seconds > 0 ? Math.min(1, Math.max(0, (t - piece.start) / piece.seconds)) : 1
  if (piece.slope === 1) return piece.from + s * (piece.to - piece.from)
  // Hermite from 0 to 1 with both end slopes `slope` (under 1: monotone), in units of the piece.
  const m = piece.slope
  const f = -2 * s ** 3 + 3 * s ** 2 + m * (s ** 3 - 2 * s ** 2 + s) + m * (s ** 3 - s ** 2)
  return piece.from + f * (piece.to - piece.from)
}

export class Apollo11Clock {
  private readonly plans: Piece[][]
  private index = 0
  private elapsed = 0
  private paused = false
  private pauseRequested = false
  private ended = false

  constructor(
    private readonly stations: TourStation[],
    private readonly listener: ClockListener,
    // Without motion: no fades.
    private readonly animate: boolean,
  ) {
    this.plans = stations.map(pieces)
  }

  start(): void {
    this.jumpTo(0)
  }

  jumpTo(index: number): void {
    this.index = Math.min(Math.max(0, index), this.stations.length - 1)
    this.elapsed = 0
    this.ended = false
    this.listener.arrived(this.index)
  }

  get isPaused(): boolean {
    return this.paused || this.pauseRequested
  }

  setPaused(paused: boolean): void {
    if (!paused) this.paused = this.pauseRequested = false
    else if (this.fade() > 0) this.pauseRequested = true
    else this.paused = true
  }

  get moment(): ClockMoment {
    return { stationIndex: this.index, get: this.get(), fade: this.fade(), paused: this.paused, ended: this.ended }
  }

  update(deltaSeconds: number): ClockMoment {
    if (this.paused || this.ended) return this.moment
    this.elapsed += deltaSeconds
    if (this.elapsed >= this.stations[this.index].seconds) this.leave()
    if (this.pauseRequested && this.fade() === 0) {
      this.pauseRequested = false
      this.paused = true
    }
    return this.moment
  }

  private leave(): void {
    if (this.index === this.stations.length - 1) {
      this.elapsed = this.stations[this.index].seconds
      this.ended = true
      this.listener.ended()
      return
    }
    const over = this.elapsed - this.stations[this.index].seconds
    this.jumpTo(this.index + 1)
    this.elapsed = over
  }

  private get(): number {
    const plan = this.plans[this.index]
    const piece = plan.find((p) => this.elapsed < p.start + p.seconds) ?? plan[plan.length - 1]
    return getIn(piece, this.elapsed)
  }

  private fade(): number {
    if (!this.animate || this.ended) return 0
    const left = this.stations[this.index].seconds - this.elapsed
    return Math.max(0, 1 - this.elapsed / FADE_SECONDS, 1 - left / FADE_SECONDS)
  }
}
