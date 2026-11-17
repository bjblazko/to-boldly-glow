import type { FlightCommand } from '../camera/flyCamera'
import { NO_COMMAND } from '../camera/flyCamera'

export interface TouchFlightPadElements {
  pad: HTMLElement
  stick: HTMLElement
  knob: HTMLElement
  forward: HTMLElement
  back: HTMLElement
  rollLeft: HTMLElement
  rollRight: HTMLElement
  boost: HTMLElement
}

// What the pad's controls are set to: the stick (x right, y up; -1..1) and the held buttons.
export interface PadState {
  stick: [number, number]
  thrust: number
  roll: number
  boost: boolean
}

// The pad as the keyboard would say it: the stick steers the nose like the arrows (pushed up, the
// nose goes down, as a stick does).
export function padCommand({ stick, thrust, roll, boost }: PadState): FlightCommand {
  return { thrust, turn: [stick[0], -stick[1]], roll, boost }
}

// The free-flight controls on a touch screen: a thumbstick that steers the nose, and held buttons
// to thrust forward and back, roll and boost. Looking around is a drag anywhere else (see
// inputController.ts).
export class TouchFlightPad {
  private stick: [number, number] = [0, 0]
  private thrust = 0
  private rollInput = 0
  private boost = false
  private stickPointer: number | null = null

  constructor(private readonly elements: TouchFlightPadElements) {
    elements.stick.addEventListener('pointerdown', this.onStickDown)
    elements.stick.addEventListener('pointermove', this.onStickMove)
    elements.stick.addEventListener('pointerup', this.onStickUp)
    elements.stick.addEventListener('pointercancel', this.onStickUp)
    this.hold(elements.forward, (held) => (this.thrust = held ? 1 : 0))
    this.hold(elements.back, (held) => (this.thrust = held ? -1 : 0))
    this.hold(elements.rollLeft, (held) => (this.rollInput = held ? -1 : 0))
    this.hold(elements.rollRight, (held) => (this.rollInput = held ? 1 : 0))
    this.hold(elements.boost, (held) => (this.boost = held))
  }

  // Touch devices only (a coarse pointer, or any touch support).
  static wanted(): boolean {
    return window.matchMedia?.('(pointer: coarse)').matches === true || navigator.maxTouchPoints > 0
  }

  setVisible(visible: boolean): void {
    this.elements.pad.hidden = !visible
    if (!visible) this.reset()
  }

  command(): FlightCommand {
    if (this.elements.pad.hidden) return NO_COMMAND
    return padCommand({ stick: this.stick, thrust: this.thrust, roll: this.rollInput, boost: this.boost })
  }

  private hold(button: HTMLElement, onChange: (held: boolean) => void): void {
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault()
      onChange(true)
    })
    for (const type of ['pointerup', 'pointercancel', 'pointerleave'] as const) button.addEventListener(type, () => onChange(false))
  }

  private onStickDown = (event: PointerEvent) => {
    this.stickPointer = event.pointerId
    this.elements.stick.setPointerCapture?.(event.pointerId)
    this.onStickMove(event)
  }

  private onStickMove = (event: PointerEvent) => {
    if (event.pointerId !== this.stickPointer) return
    const bounds = this.elements.stick.getBoundingClientRect()
    const radius = bounds.width / 2
    const offset = [(event.clientX - bounds.left - radius) / radius, (event.clientY - bounds.top - radius) / radius]
    const length = Math.max(Math.hypot(offset[0], offset[1]), 1)
    this.stick = [offset[0] / length, -offset[1] / length]
    this.elements.knob.style.transform = `translate(${this.stick[0] * radius * 0.6}px, ${-this.stick[1] * radius * 0.6}px)`
  }

  private onStickUp = (event: PointerEvent) => {
    if (event.pointerId === this.stickPointer) this.reset()
  }

  private reset(): void {
    this.stick = [0, 0]
    this.thrust = 0
    this.rollInput = 0
    this.boost = false
    this.stickPointer = null
    this.elements.knob.style.transform = ''
  }
}
