import { hideLabel } from '../../labels/screenLabel'

export const PHASE_LABEL_AGES = [0, 90, 180, 270] as const

// The Moon phases lesson's labels (they live in index.html, outside the body-label layer).
export class PhasesLabels {
  readonly sunlight: HTMLElement
  // New moon, first quarter, full moon and last quarter, at PHASE_LABEL_AGES around the orbit.
  readonly phases: HTMLElement[]
  readonly earthShadow: HTMLElement
  readonly moonOrbit: HTMLElement
  readonly nearSide: HTMLElement

  constructor(find: (selector: string) => HTMLElement) {
    this.sunlight = find('#phases-sunlight-label')
    this.phases = ['new', 'first-quarter', 'full', 'last-quarter'].map((id) => find(`#phases-${id}-label`))
    this.earthShadow = find('#phases-earth-shadow-label')
    this.moonOrbit = find('#phases-moon-orbit-label')
    this.nearSide = find('#phases-near-side-label')
  }

  hideAll(): void {
    for (const label of [this.sunlight, ...this.phases, this.earthShadow, this.moonOrbit, this.nearSide]) hideLabel(label)
  }
}
