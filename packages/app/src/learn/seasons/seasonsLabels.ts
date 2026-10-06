import { hideLabel } from '../../labels/screenLabel'

// The seasons lesson's explanatory labels (they live in index.html, outside the body-label layer).
export class SeasonsLabels {
  readonly locationA: HTMLElement
  readonly locationB: HTMLElement
  readonly tilt: HTMLElement
  readonly axis: HTMLElement
  readonly equator: HTMLElement
  readonly reference: HTMLElement
  readonly towardSun: HTMLElement
  readonly rightAngle: HTMLElement

  constructor(find: (selector: string) => HTMLElement) {
    this.locationA = find('#location-a-label')
    this.locationB = find('#location-b-label')
    this.tilt = find('#axis-tilt-label')
    this.axis = find('#axis-line-label')
    this.equator = find('#equator-line-label')
    this.reference = find('#reference-line-label')
    this.towardSun = find('#toward-sun-label')
    this.rightAngle = find('#right-angle-label')
  }

  hideAll(): void {
    for (const label of this.all()) hideLabel(label)
  }

  hideLocations(): void {
    hideLabel(this.locationA)
    hideLabel(this.locationB)
  }

  private all(): HTMLElement[] {
    return [this.locationA, this.locationB, this.tilt, this.axis, this.equator, this.reference, this.towardSun, this.rightAngle]
  }
}
