import { litFraction, phaseName, waxing } from './phasesGeometry'

// The lit part of a unit disc (SVG path, y down) at this phase angle: the limb on the lit side - the
// right while waxing, the left while waning, as seen from the northern hemisphere - closed by the
// terminator, a half ellipse that bulges past the middle for a gibbous Moon and stays short of it for
// a crescent.
export function litShapePath(phaseAngleRadians: number, isWaxing: boolean): string {
  const terminator = Math.cos(phaseAngleRadians)
  const limbSweep = isWaxing ? 1 : 0
  const terminatorSweep = terminator > 0 === isWaxing ? 1 : 0
  const radius = Math.abs(terminator).toFixed(4)
  return `M 0 -1 A 1 1 0 0 ${limbSweep} 0 1 A ${radius} 1 0 0 ${terminatorSweep} 0 -1 Z`
}

// The space chapters' "seen from Earth" card: the Moon's shape right now, its name, how much is lit.
export class PhaseInset {
  constructor(
    private readonly card: HTMLElement,
    private readonly parts: { litShape: Element; name: HTMLElement; lit: HTMLElement },
  ) {}

  show(phaseAngleRadians: number, ageDegrees: number): void {
    this.card.hidden = false
    this.parts.litShape.setAttribute('d', litShapePath(phaseAngleRadians, waxing(ageDegrees)))
    setText(this.parts.name, phaseName(ageDegrees))
    setText(this.parts.lit, `${Math.round(litFraction(phaseAngleRadians) * 100)}% lit`)
  }

  hide(): void {
    this.card.hidden = true
  }
}

function setText(element: HTMLElement, text: string): void {
  if (element.textContent !== text) element.textContent = text
}
