import { projectToCss, type Viewpoint } from '../../camera/viewpoint'
import { hideLabel, placeLabel } from '../../labels/screenLabel'
import type { Vec3 } from '../../math/tuples'

export interface LabelSpec {
  text: string
  point: Vec3
  // A ring on a point (a part, an engraving), a probe on its route, a region (the heliopause), or a
  // measure marked in the scene (a height).
  variant?: 'hotspot' | 'probe' | 'region' | 'mark'
  // A second, quieter line under the text (what an abbreviation stands for).
  note?: string
}

// The Voyager lessons' labels in the scene: one per probe part, record engraving or probe on the
// route, made on first use and kept (their text set per frame from the lesson's words), plus the
// date and distances shown along the route.
export class VoyagerLabels {
  private readonly labels = new Map<string, HTMLElement>()
  private readonly shown = new Set<string>()
  private clockText = ''

  constructor(
    private readonly layer: HTMLElement,
    // The route's date and distances; the mission tours show them on their card instead.
    private readonly routeClock: HTMLElement | null,
  ) {}

  // Starts a frame: every label not placed again before `finish` is hidden.
  begin(): void {
    this.shown.clear()
  }

  place(id: string, { text, point, variant = 'hotspot', note }: LabelSpec, viewpoint: Viewpoint): void {
    const label = this.label(id, variant)
    setLines(label, text, note)
    placeLabel(label, projectToCss(viewpoint, point))
    this.shown.add(id)
  }

  finish(): void {
    for (const [id, label] of this.labels) if (!this.shown.has(id)) hideLabel(label)
  }

  // The date and the probes' distances, in the corner (rewritten only when they change).
  showClock(lines: string[]): void {
    if (!this.routeClock) return
    this.routeClock.hidden = false
    if (lines.join('\n') === this.clockText) return
    this.clockText = lines.join('\n')
    this.routeClock.replaceChildren(...lines.map((line) => Object.assign(document.createElement('span'), { textContent: line })))
  }

  hideClock(): void {
    if (this.routeClock) this.routeClock.hidden = true
  }

  hideAll(): void {
    for (const label of this.labels.values()) hideLabel(label)
    this.hideClock()
  }

  private label(id: string, variant: string): HTMLElement {
    let label = this.labels.get(id)
    if (!label) {
      label = Object.assign(document.createElement('div'), { className: `body-label voyager-label is-${variant}`, hidden: true })
      this.layer.append(label)
      this.labels.set(id, label)
    }
    return label
  }
}

// The label's text, and its note as a second line (both rewritten only when they change).
function setLines(label: HTMLElement, text: string, note: string | undefined): void {
  const [main, second] = [label.firstElementChild, label.lastElementChild] as (HTMLElement | null)[]
  if (main?.textContent === text && (note === undefined ? label.childElementCount === 1 : second?.textContent === note)) return
  const lines = [Object.assign(document.createElement('span'), { textContent: text })]
  if (note !== undefined) lines.push(Object.assign(document.createElement('span'), { className: 'body-label-note', textContent: note }))
  label.replaceChildren(...lines)
}
