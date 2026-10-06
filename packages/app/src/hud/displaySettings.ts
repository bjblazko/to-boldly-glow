// The Display panel's switches. Each one mirrors its state onto the canvas as a data attribute, so
// the current display state can be read from the DOM (the e2e tests rely on it).
class DisplaySwitch {
  constructor(
    private readonly checkbox: HTMLInputElement,
    private readonly canvas: HTMLCanvasElement,
    private readonly datasetKey: string,
  ) {
    checkbox.addEventListener('change', () => this.mirror())
    this.mirror()
  }

  get on(): boolean {
    return this.checkbox.checked
  }

  set(on: boolean): void {
    this.checkbox.checked = on
    this.mirror()
  }

  private mirror(): void {
    this.canvas.dataset[this.datasetKey] = String(this.checkbox.checked)
  }
}

// The switches a lesson turns off while it runs, and the user's own settings it restores afterward.
export interface LessonDisplaySnapshot {
  orbitPaths: boolean
  bodyLabels: boolean
  flares: boolean
}

export class DisplaySettings {
  readonly starfield: DisplaySwitch
  readonly bloom: DisplaySwitch
  readonly flares: DisplaySwitch
  readonly moons: DisplaySwitch
  readonly orbitPaths: DisplaySwitch
  readonly bodyLabels: DisplaySwitch

  constructor(canvas: HTMLCanvasElement, findCheckbox: (selector: string) => HTMLInputElement) {
    const displaySwitch = (selector: string, datasetKey: string) => new DisplaySwitch(findCheckbox(selector), canvas, datasetKey)
    this.starfield = displaySwitch('#starfield-toggle', 'starfield')
    this.bloom = displaySwitch('#bloom-toggle', 'bloom')
    this.flares = displaySwitch('#flares-toggle', 'flares')
    this.moons = displaySwitch('#moons-toggle', 'moons')
    this.orbitPaths = displaySwitch('#orbit-paths-toggle', 'orbitPaths')
    this.bodyLabels = displaySwitch('#body-labels-toggle', 'labelsVisible')
  }

  // Lessons are cleaner without explore-mode clutter; returns what to restore afterward.
  clearForLesson(): LessonDisplaySnapshot {
    const snapshot = { orbitPaths: this.orbitPaths.on, bodyLabels: this.bodyLabels.on, flares: this.flares.on }
    this.orbitPaths.set(false)
    this.bodyLabels.set(false)
    this.flares.set(false)
    return snapshot
  }

  restoreAfterLesson(snapshot: LessonDisplaySnapshot): void {
    this.orbitPaths.set(snapshot.orbitPaths)
    this.bodyLabels.set(snapshot.bodyLabels)
    this.flares.set(snapshot.flares)
  }
}
