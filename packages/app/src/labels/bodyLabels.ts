import { projectToCss, type Viewpoint } from '../camera/viewpoint'
import { PLANETS, SUN } from '../solarSystem/bodies'
import { MOONS } from '../solarSystem/moons'
import type { SceneLayout } from '../scene/sceneLayout'
import type { Vec3 } from '../math/tuples'
import { SMALL_BODIES } from '../smallBodies/smallBodyCatalog'
import { hideLabel, placeLabel } from './screenLabel'
import './labels.css'

// The name of every body the scene shows, following it on screen.
export class BodyLabels {
  private readonly labels = new Map<string, HTMLElement>()

  constructor(private readonly container: HTMLElement) {
    for (const body of [SUN, ...PLANETS]) this.add(body.id, body.name, 'body-label')
    for (const moon of MOONS) this.add(moon.id, moon.name, 'moon-label')
    for (const body of SMALL_BODIES) this.add(body.id, body.name, 'small-body-label')
  }

  // Small bodies aren't part of the scene layout (they move on their own orbits); the caller passes
  // the ones currently shown.
  update(layout: SceneLayout, viewpoint: Viewpoint, labelsOn: boolean, smallBodies: readonly { id: string; position: Vec3 }[] = []): void {
    const visible = labelsOn || layout.alwaysShowBodyLabels === true
    this.container.hidden = !visible
    if (!visible) return
    const shown = new Set<string>([SUN.id])
    placeLabel(this.labels.get(SUN.id)!, projectToCss(viewpoint, layout.sun.position))
    for (const body of [...layout.planets, ...layout.moons].map((pose) => ({ id: pose.definition.id, position: pose.position })).concat(smallBodies)) {
      shown.add(body.id)
      placeLabel(this.labels.get(body.id)!, projectToCss(viewpoint, body.position))
    }
    for (const [id, label] of this.labels) if (!shown.has(id)) hideLabel(label)
  }

  private add(id: string, name: string, className: string): void {
    const label = document.createElement('div')
    label.className = className
    label.textContent = name
    this.container.appendChild(label)
    this.labels.set(id, label)
  }
}
