import { hideLabel } from '../../labels/screenLabel'

// The eclipse lesson's explanatory labels (they live in index.html, outside the body-label layer).
export class EclipseLabels {
  readonly umbra: HTMLElement
  readonly penumbra: HTMLElement
  readonly moonOrbit: HTMLElement
  readonly orbitPlane: HTMLElement
  readonly glasses: HTMLElement
  readonly corona: HTMLElement

  constructor(find: (selector: string) => HTMLElement) {
    this.umbra = find('#eclipse-umbra-label')
    this.penumbra = find('#eclipse-penumbra-label')
    this.moonOrbit = find('#eclipse-moon-orbit-label')
    this.orbitPlane = find('#eclipse-orbit-plane-label')
    this.glasses = find('#eclipse-glasses-label')
    this.corona = find('#eclipse-corona-label')
  }

  hideAll(): void {
    for (const label of [this.umbra, this.penumbra, this.moonOrbit, this.orbitPlane, this.glasses, this.corona]) hideLabel(label)
  }
}
