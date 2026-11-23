import { jklRate, jogSeconds, MAX_RATE, shuttleRate, timecode } from './scrubControls'

type Find = <T extends HTMLElement>(selector: string) => T

// What the jog and shuttle drive: a tour's place in its whole length, and the speed it runs at while
// shuttled (0: as the tour itself plays).
export interface Scrubbable {
  readonly length: number
  readonly position: number
  readonly rate: number
  // Each station's start and length in the tour (s), and its title.
  readonly stations: readonly { start: number; seconds: number; title: string }[]
  seek(position: number): void
  setRate(rate: number): void
  // The line beside the timecode (the mission time).
  readout(): string
}

// The degrees the jog wheel turns for one notch (a frame).
const NOTCH_DEGREES = 12

// The jog and shuttle panel over the bar, shown and hidden by the bar's Jog button: the whole tour
// as a strip to jump along, the spring-loaded shuttle (let go, it springs back to the middle and the
// tour stands still) and the jog wheel; J, K, L and the arrow keys work while a tour that has it runs,
// the panel shown or not.
export class TourShuttle {
  private target: Scrubbable | null = null
  private readonly root: HTMLElement
  private readonly toggle: HTMLButtonElement
  private readonly overview: HTMLElement
  private readonly playhead: HTMLElement
  private readonly spring: HTMLElement
  private readonly knob: HTMLElement
  private readonly rateText: HTMLElement
  private readonly timecodeText: HTMLElement
  private readonly getText: HTMLElement
  private readonly jog: HTMLElement
  private springHeld = false
  private jogAngle: number | null = null
  private jogTurned = 0

  constructor(find: Find) {
    this.root = find('#mission-shuttle')
    this.toggle = find<HTMLButtonElement>('#mission-shuttle-btn')
    this.overview = find('#mission-shuttle-overview')
    this.playhead = this.overview.querySelector<HTMLElement>('.hud-shuttle-playhead')!
    this.spring = find('#mission-shuttle-spring')
    this.knob = this.spring.querySelector<HTMLElement>('.hud-shuttle-knob')!
    this.rateText = find('#mission-shuttle-rate')
    this.timecodeText = find('#mission-shuttle-timecode')
    this.getText = find('#mission-shuttle-get')
    this.jog = find('#mission-shuttle-jog')
    this.toggle.addEventListener('click', () => this.setShown(Boolean(this.root.hidden)))
    this.listenOverview()
    this.listenSpring()
    this.listenJog()
    window.addEventListener('keydown', (event) => this.key(event))
  }

  attach(target: Scrubbable): void {
    this.target = target
    this.renderSegments(target)
  }

  detach(): void {
    this.target = null
    this.setShown(false)
  }

  // Once a frame: where the tour is.
  update(): void {
    const target = this.target
    if (!target || this.root.hidden) return
    const fraction = target.length > 0 ? target.position / target.length : 0
    this.playhead.style.left = `${(fraction * 100).toFixed(3)}%`
    this.overview.setAttribute('aria-valuenow', String(Math.round(target.position)))
    this.timecodeText.textContent = timecode(target.position)
    this.getText.textContent = target.readout()
    this.rateText.textContent = target.rate === 0 ? '' : `${target.rate > 0 ? '▶' : '◀'} ${formatRate(Math.abs(target.rate))}×`
    this.spring.setAttribute('aria-valuenow', String(target.rate))
    if (!this.springHeld) this.knob.style.setProperty('--push', knobPush(target.rate).toFixed(3))
  }

  private setShown(shown: boolean): void {
    this.root.hidden = !shown
    this.toggle.setAttribute('aria-pressed', String(shown))
  }

  private renderSegments(target: Scrubbable): void {
    this.overview.setAttribute('aria-valuemax', String(Math.round(target.length)))
    const segments = this.overview.querySelector<HTMLElement>('.hud-shuttle-segments')!
    segments.replaceChildren(
      ...target.stations.map((station) => {
        const segment = Object.assign(document.createElement('span'), { className: 'hud-shuttle-segment', title: station.title })
        segment.style.flexGrow = String(station.seconds)
        return segment
      }),
    )
  }

  private listenOverview(): void {
    const seekTo = (event: PointerEvent) => {
      const target = this.target
      if (!target) return
      const box = this.overview.getBoundingClientRect()
      target.setRate(0)
      target.seek(((event.clientX - box.left) / box.width) * target.length)
    }
    this.overview.addEventListener('pointerdown', (event) => {
      this.overview.setPointerCapture(event.pointerId)
      seekTo(event)
    })
    this.overview.addEventListener('pointermove', (event) => {
      if (this.overview.hasPointerCapture(event.pointerId)) seekTo(event)
    })
  }

  private listenSpring(): void {
    const push = (event: PointerEvent) => {
      const box = this.spring.getBoundingClientRect()
      const amount = Math.max(-1, Math.min(1, (event.clientX - (box.left + box.width / 2)) / (box.width / 2)))
      this.knob.style.setProperty('--push', amount.toFixed(3))
      this.target?.setRate(shuttleRate(amount))
    }
    this.spring.addEventListener('pointerdown', (event) => {
      this.spring.setPointerCapture(event.pointerId)
      this.springHeld = true
      this.spring.classList.add('is-held')
      push(event)
    })
    this.spring.addEventListener('pointermove', (event) => {
      if (this.springHeld) push(event)
    })
    const release = () => {
      if (!this.springHeld) return
      this.springHeld = false
      this.spring.classList.remove('is-held')
      this.target?.setRate(0)
    }
    this.spring.addEventListener('pointerup', release)
    this.spring.addEventListener('pointercancel', release)
  }

  private listenJog(): void {
    const angle = (event: PointerEvent) => {
      const box = this.jog.getBoundingClientRect()
      return (Math.atan2(event.clientY - (box.top + box.height / 2), event.clientX - (box.left + box.width / 2)) * 180) / Math.PI
    }
    this.jog.addEventListener('pointerdown', (event) => {
      this.jog.setPointerCapture(event.pointerId)
      this.jogAngle = angle(event)
      this.target?.setRate(0)
    })
    this.jog.addEventListener('pointermove', (event) => {
      if (this.jogAngle === null) return
      const now = angle(event)
      const turned = ((now - this.jogAngle + 540) % 360) - 180
      this.jogAngle = now
      this.turnJog(turned, event.shiftKey)
    })
    this.jog.addEventListener('pointerup', () => (this.jogAngle = null))
    this.jog.addEventListener('wheel', (event) => {
      event.preventDefault()
      this.target?.setRate(0)
      this.turnJog(Math.sign(event.deltaY || event.deltaX) * NOTCH_DEGREES, event.shiftKey)
    })
  }

  // Turns the wheel's dimple and steps the tour a notch at a time.
  private turnJog(degrees: number, coarse: boolean): void {
    this.jogTurned += degrees
    this.jog.style.setProperty('--jog-turn', `${this.jogTurned}deg`)
    const notches = Math.trunc(this.jogTurned / NOTCH_DEGREES) - Math.trunc((this.jogTurned - degrees) / NOTCH_DEGREES)
    const target = this.target
    if (target && notches !== 0) target.seek(target.position + jogSeconds(notches, coarse))
  }

  private key(event: KeyboardEvent): void {
    const target = this.target
    if (!target || event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return
    if (keyed(target, event)) event.preventDefault()
  }
}

// J, K, L and the arrow keys; whether the key was one of them.
function keyed(target: Scrubbable, event: KeyboardEvent): boolean {
  const key = event.key.toLowerCase()
  if (key === 'j' || key === 'k' || key === 'l') {
    target.setRate(jklRate(target.rate, key))
    return true
  }
  const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key]
  if (!step) return false
  target.setRate(0)
  target.seek(target.position + jogSeconds(step, event.shiftKey))
  return true
}

// The knob's place for a speed set by the keys: the inverse of the shuttle's curve.
function knobPush(rate: number): number {
  if (rate === 0) return 0
  const amount = 0.05 + (0.95 * Math.log(Math.abs(rate) / 0.25)) / Math.log(MAX_RATE / 0.25)
  return Math.sign(rate) * Math.min(1, Math.max(0.05, amount))
}

function formatRate(rate: number): string {
  return rate < 1 ? rate.toFixed(2).replace(/0$/, '') : rate < 10 ? rate.toFixed(1).replace(/\.0$/, '') : String(Math.round(rate))
}

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
}
