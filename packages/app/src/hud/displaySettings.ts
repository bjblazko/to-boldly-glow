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
  smallBodyOrbits: boolean
  bodyLabels: boolean
  flares: boolean
  clouds: boolean
  asteroids: boolean
  comets: boolean
}

// Lessons stage their own scenes: explore-mode clutter, and the real asteroids and comets, would
// only distract from them.
const HIDDEN_IN_LESSONS = ['orbitPaths', 'smallBodyOrbits', 'bodyLabels', 'flares', 'clouds', 'asteroids', 'comets'] as const

export class DisplaySettings {
  readonly starfield: DisplaySwitch
  readonly milkyWay: DisplaySwitch
  readonly asteroids: DisplaySwitch
  readonly comets: DisplaySwitch
  readonly bloom: DisplaySwitch
  readonly flares: DisplaySwitch
  readonly moons: DisplaySwitch
  readonly orbitPaths: DisplaySwitch
  readonly smallBodyOrbits: DisplaySwitch
  readonly bodyLabels: DisplaySwitch
  readonly clouds: DisplaySwitch

  constructor(canvas: HTMLCanvasElement, findCheckbox: (selector: string) => HTMLInputElement) {
    const displaySwitch = (selector: string, datasetKey: string) => new DisplaySwitch(findCheckbox(selector), canvas, datasetKey)
    this.starfield = displaySwitch('#starfield-toggle', 'starfield')
    this.milkyWay = displaySwitch('#milky-way-toggle', 'milkyWay')
    this.asteroids = displaySwitch('#asteroids-toggle', 'asteroids')
    this.comets = displaySwitch('#comets-toggle', 'comets')
    this.bloom = displaySwitch('#bloom-toggle', 'bloom')
    this.flares = displaySwitch('#flares-toggle', 'flares')
    this.moons = displaySwitch('#moons-toggle', 'moons')
    this.orbitPaths = displaySwitch('#orbit-paths-toggle', 'orbitPaths')
    this.smallBodyOrbits = displaySwitch('#small-body-orbits-toggle', 'smallBodyOrbits')
    this.bodyLabels = displaySwitch('#body-labels-toggle', 'labelsVisible')
    this.clouds = displaySwitch('#clouds-toggle', 'clouds')
  }

  // Returns what to restore afterward.
  clearForLesson(): LessonDisplaySnapshot {
    const snapshot = Object.fromEntries(HIDDEN_IN_LESSONS.map((key) => [key, this[key].on])) as unknown as LessonDisplaySnapshot
    for (const key of HIDDEN_IN_LESSONS) this[key].set(false)
    return snapshot
  }

  restoreAfterLesson(snapshot: LessonDisplaySnapshot): void {
    for (const key of HIDDEN_IN_LESSONS) this[key].set(snapshot[key])
  }
}
