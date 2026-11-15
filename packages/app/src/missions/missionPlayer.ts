import { easeInOutCubic } from '../math/easing'

// Plays a mission tour: it flies from station to station (the date racing in the middle of a leg
// and slowing toward the next station), holds at a station while its card is read out, and fades
// into and out of a planet flyby, where the flyby's own clock runs - slowest at closest approach.
// Pure: no DOM, no rendering, so it can be tested and driven by the frame loop alike.

export type MissionPhase = 'flight' | 'fadeIn' | 'encounter' | 'fadeOut' | 'hold' | 'end'

export interface MissionMoment {
  stationIndex: number
  phase: MissionPhase
  // Days since J2000: during a flyby, the flyby's moment.
  day: number
  // During a flyby: seconds from closest approach.
  encounterSeconds: number
  // How dark the screen is, for the cut into and out of a flyby (0 to 1).
  fade: number
  paused: boolean
}

export interface MissionListener {
  // A station's card opens (and its text is read out).
  arrived(stationIndex: number): void
  ended(): void
}

export interface MissionPlan {
  // Each station's day (days since J2000) and whether it is a flyby.
  stations: { day: number; encounter: boolean }[]
  // How long each station's text takes to read out, in seconds.
  readingSeconds(stationIndex: number): number
}

export const FADE_SECONDS = 0.7
// The flyby's clock: 30 hours either side of closest approach.
export const ENCOUNTER_SPAN_SECONDS = 30 * 3600
const MIN_HOLD_SECONDS = 5
const MIN_ENCOUNTER_SECONDS = 18
const READING_MARGIN_SECONDS = 2
// A leg takes longer the more time it covers: about 8 s for two years, 10 s for fourteen.
const FLIGHT_BASE_SECONDS = 4
const FLIGHT_SECONDS_PER_DECADE = 1.6
// Near closest approach the flyby's clock slows down: its time goes as |u|^1.8.
const ENCOUNTER_EASE = 1.8

export class MissionPlayer {
  private index = 0
  private phase: MissionPhase = 'hold'
  private elapsed = 0
  private paused = false
  // Pausing waits for a fade to finish, so the tour never stands still half dark.
  private pauseRequested = false
  // A leg that starts from a flyby starts dark and fades up.
  private leftFlyby = false

  constructor(
    private readonly plan: MissionPlan,
    private readonly listener: MissionListener,
    // Without motion, legs are cut instead of flown.
    private readonly animate: boolean,
  ) {}

  start(): void {
    this.jumpTo(0)
  }

  get moment(): MissionMoment {
    return { stationIndex: this.index, phase: this.phase, day: this.day(), encounterSeconds: this.encounterSeconds(), fade: this.fade(), paused: this.paused }
  }

  get isPaused(): boolean {
    return this.paused || this.pauseRequested
  }

  setPaused(paused: boolean): void {
    if (!paused) {
      this.paused = this.pauseRequested = false
      return
    }
    if (this.isFading()) this.pauseRequested = true
    else this.paused = true
  }

  // Opens a station straight away (a flyby fades in first).
  jumpTo(index: number): void {
    this.index = Math.min(Math.max(0, index), this.plan.stations.length - 1)
    this.enter(this.plan.stations[this.index].encounter ? 'fadeIn' : 'hold')
  }

  update(deltaSeconds: number): MissionMoment {
    if (!this.paused && this.phase !== 'end') {
      this.elapsed += deltaSeconds
      if (this.elapsed >= this.phaseSeconds()) this.advance()
    }
    return this.moment
  }

  private advance(): void {
    const next = NEXT_PHASE[this.phase](this)
    this.leftFlyby = this.phase === 'fadeOut'
    if (next === 'flight') this.index += 1
    this.enter(next)
  }

  private enter(phase: MissionPhase): void {
    this.phase = phase
    this.elapsed = 0
    if (this.pauseRequested && !this.isFading()) {
      this.pauseRequested = false
      this.paused = true
    }
    if (phase === 'hold' || phase === 'encounter') this.listener.arrived(this.index)
    if (phase === 'end') this.listener.ended()
  }

  // After a station: the next leg, or the end.
  leaveStation(): MissionPhase {
    return this.index < this.plan.stations.length - 1 ? 'flight' : 'end'
  }

  // At the end of a leg: a flyby fades in, a milestone opens.
  arrive(): MissionPhase {
    return this.plan.stations[this.index].encounter ? 'fadeIn' : 'hold'
  }

  private isFading(): boolean {
    return this.phase === 'fadeIn' || this.phase === 'fadeOut'
  }

  private phaseSeconds(): number {
    if (this.isFading()) return FADE_SECONDS
    if (this.phase === 'flight') return this.flightSeconds()
    const reading = this.plan.readingSeconds(this.index) + READING_MARGIN_SECONDS
    return Math.max(this.phase === 'encounter' ? MIN_ENCOUNTER_SECONDS : MIN_HOLD_SECONDS, reading)
  }

  private flightSeconds(): number {
    if (!this.animate) return 0
    const days = this.legDays()
    return FLIGHT_BASE_SECONDS + FLIGHT_SECONDS_PER_DECADE * Math.log10(1 + Math.max(0, days))
  }

  private legDays(): number {
    const stations = this.plan.stations
    return stations[this.index].day - stations[this.index - 1].day
  }

  private progress(): number {
    const seconds = this.phaseSeconds()
    return seconds > 0 ? Math.min(1, this.elapsed / seconds) : 1
  }

  private day(): number {
    const stations = this.plan.stations
    const here = stations[this.index].day
    if (this.phase === 'flight') return stations[this.index - 1].day + this.legDays() * easeInOutCubic(this.progress())
    return here + this.encounterSeconds() / 86400
  }

  private encounterSeconds(): number {
    if (this.phase === 'fadeIn') return -ENCOUNTER_SPAN_SECONDS
    if (this.phase === 'fadeOut') return ENCOUNTER_SPAN_SECONDS
    if (this.phase !== 'encounter') return 0
    const u = 2 * this.progress() - 1
    return ENCOUNTER_SPAN_SECONDS * Math.sign(u) * Math.abs(u) ** ENCOUNTER_EASE
  }

  private fade(): number {
    if (this.isFading()) return this.progress()
    const fadingUp = this.phase === 'encounter' || (this.phase === 'flight' && this.leftFlyby)
    return fadingUp ? Math.max(0, 1 - this.elapsed / FADE_SECONDS) : 0
  }
}

// What follows each phase when it has run its time.
const NEXT_PHASE: Record<MissionPhase, (player: MissionPlayer) => MissionPhase> = {
  flight: (player) => player.arrive(),
  fadeIn: () => 'encounter',
  encounter: () => 'fadeOut',
  fadeOut: (player) => player.leaveStation(),
  hold: (player) => player.leaveStation(),
  end: () => 'end',
}
