import { vec3 } from 'gl-matrix'
import { projectToCss, type Viewpoint } from '../../camera/viewpoint'
import { placeLabel } from '../../labels/screenLabel'
import { pointAlong, type Vec3 } from '../../math/tuples'
import type { SceneLayout } from '../../scene/sceneLayout'
import { moonFlatOrbitPosition } from '../../solarSystem/moonOrbit'
import { ECLIPTIC_NORTH } from '../../solarSystem/poleOrientation'
import { OverlayLines } from '../seasons/overlayLines'
import type { EclipseChapterKind } from '../lessonTypes'
import {
  EARTH_POSITION,
  MOON_ORBIT_RADIUS,
  moonOrbitTilt,
  perpendicularUnit,
  shadowEdgeLines,
  shadowOnEarth,
  shadowOutlinePoints,
  type ShadowSpot,
  type Sphere,
} from './eclipseGeometry'
import type { EclipseLabels } from './eclipseLabels'

const ORBIT_SEGMENTS = 96
const OUTLINE_SEGMENTS = 96
// How far past Earth's center the penumbra's edges are drawn, along the shadow.
const PENUMBRA_REACH_PAST_EARTH = 6
// The line through the Sun and Earth: the plane of Earth's orbit, seen edge-on.
const ORBIT_PLANE_LINE = new Float32Array([0, 0, 0, EARTH_POSITION[0] + MOON_ORBIT_RADIUS + 2, 0, 0])
const ORBIT_PLANE_LABEL_AT: Vec3 = [16, 0, 0]

type DiagramLineId = 'moon-orbit' | 'orbit-plane' | 'umbra-upper' | 'umbra-lower' | 'penumbra-upper' | 'penumbra-lower'
type OutlineId = 'umbra-outline' | 'penumbra-outline'

const UMBRA_COLOR = [1.0, 0.3, 0.2, 1] as const
const PENUMBRA_COLOR = [0.3, 0.6, 1.0, 1] as const

interface OverlayFrame {
  viewpoint: Viewpoint
  nowSeconds: number
  labels: EclipseLabels
  nodeDegrees: number
}

// The space chapters' construction lines: the Moon's tilted orbit, the plane of Earth's orbit
// (edge-on, through the Sun and Earth) and the edges of the Moon's shadow - the umbra's converging
// to its tip, the penumbra's crossing and spreading out. In the shadow close-up, the outlines of the
// shadow's two parts where they fall on Earth, in the same colors.
export class ShadowOverlay {
  private readonly lines: OverlayLines<DiagramLineId>
  private readonly outlines: OverlayLines<OutlineId>
  private shownKind: EclipseChapterKind | null = null

  constructor(device: GPUDevice, linePipeline: GPURenderPipeline) {
    this.outlines = new OverlayLines<OutlineId>(device, linePipeline, {
      'umbra-outline': { capacity: OUTLINE_SEGMENTS + 1, color: [...UMBRA_COLOR], mode: 'solid' },
      'penumbra-outline': { capacity: OUTLINE_SEGMENTS + 1, color: [...PENUMBRA_COLOR], mode: 'solid' },
    })
    this.lines = new OverlayLines<DiagramLineId>(device, linePipeline, {
      'moon-orbit': { capacity: ORBIT_SEGMENTS + 1, color: [0.62, 0.66, 0.78, 1], mode: 'solid' },
      'orbit-plane': { capacity: 2, color: [0.3, 0.45, 0.62, 1], mode: 'solid' },
      'umbra-upper': { capacity: 2, color: [...UMBRA_COLOR], mode: 'solid' },
      'umbra-lower': { capacity: 2, color: [...UMBRA_COLOR], mode: 'solid' },
      'penumbra-upper': { capacity: 2, color: [...PENUMBRA_COLOR], mode: 'solid' },
      'penumbra-lower': { capacity: 2, color: [...PENUMBRA_COLOR], mode: 'solid' },
    })
  }

  update(layout: SceneLayout, kind: EclipseChapterKind, frame: OverlayFrame): void {
    const [earth, moon] = [layout.planets[0], layout.moons[0]]
    frame.labels.hideAll()
    this.shownKind = null
    if (!earth || !moon || kind === 'eclipseSky') return
    if (kind === 'eclipseShadow') this.showShadow({ sun: layout.sun, moon, earth }, frame)
    else this.showDiagram(layout.sun, moon, frame)
  }

  // Expects the line pipeline to be set on the pass.
  draw(pass: GPURenderPassEncoder): void {
    if (this.shownKind === 'eclipseOrbit') this.lines.draw(pass)
    else if (this.shownKind === 'eclipseShadow') this.outlines.draw(pass)
  }

  private showDiagram(sun: Sphere, moon: Sphere, frame: OverlayFrame): void {
    const lines = diagramLines(sun, moon, frame.nodeDegrees)
    this.lines.update(lines, frame.viewpoint, frame.nowSeconds)
    placeDiagramLabels(lines, moon, frame)
    this.shownKind = 'eclipseOrbit'
  }

  // While the shadow is on Earth: its two parts' outlines and names.
  private showShadow(bodies: { sun: Sphere; moon: Sphere; earth: Sphere }, frame: OverlayFrame): void {
    const spot = shadowOnEarth(bodies.sun, bodies.moon, bodies.earth)
    if (!spot) return
    const outline = (part: 'umbra' | 'penumbra') => shadowOutlinePoints(spot, bodies, part, OUTLINE_SEGMENTS)
    this.outlines.update({ 'umbra-outline': outline('umbra'), 'penumbra-outline': outline('penumbra') }, frame.viewpoint, frame.nowSeconds)
    placeShadowLabels(spot, bodies.earth, frame)
    this.shownKind = 'eclipseShadow'
  }
}

function diagramLines(sun: Sphere, moon: Sphere, nodeDegrees: number): Record<DiagramLineId, Float32Array> {
  const { umbra, penumbra } = shadowEdgeLines(sun, moon, [...ECLIPTIC_NORTH], EARTH_POSITION[0] + PENUMBRA_REACH_PAST_EARTH)
  return {
    'moon-orbit': moonOrbitPoints(nodeDegrees),
    'orbit-plane': ORBIT_PLANE_LINE,
    'umbra-upper': umbra[0],
    'umbra-lower': umbra[1],
    'penumbra-upper': penumbra[0],
    'penumbra-lower': penumbra[1],
  }
}

export function moonOrbitPoints(nodeDegrees: number): Float32Array {
  const tilt = moonOrbitTilt(nodeDegrees)
  const points = new Float32Array((ORBIT_SEGMENTS + 1) * 3)
  for (let i = 0; i <= ORBIT_SEGMENTS; i++) {
    const tilted = vec3.transformMat4(vec3.create(), moonFlatOrbitPosition(MOON_ORBIT_RADIUS, (i / ORBIT_SEGMENTS) * 2 * Math.PI), tilt)
    points.set([EARTH_POSITION[0] + tilted[0], EARTH_POSITION[1] + tilted[1], EARTH_POSITION[2] + tilted[2]], i * 3)
  }
  return points
}

// The orbit's point farthest from the Sun: beyond Earth, clear of the shadow lines.
function farSideOf(orbit: Float32Array): Vec3 {
  let best = 0
  for (let i = 3; i < orbit.length; i += 3) if (orbit[i] > orbit[best]) best = i
  return [orbit[best], orbit[best + 1], orbit[best + 2]]
}

function placeDiagramLabels(lines: Record<DiagramLineId, Float32Array>, moon: Sphere, { viewpoint, labels }: OverlayFrame): void {
  const place = (label: HTMLElement, point: ArrayLike<number>) => placeLabel(label, projectToCss(viewpoint, point))
  setText(labels.umbra, 'Umbra')
  setText(labels.penumbra, 'Penumbra')
  // Halfway from the Moon to the umbra's tip; the penumbra's near the far end of its edge.
  const tip = lines['umbra-upper'].subarray(3, 6)
  place(labels.umbra, [0, 1, 2].map((i) => (moon.position[i] + tip[i]) / 2))
  const penumbraEdge = lines['penumbra-lower']
  place(labels.penumbra, [0, 1, 2].map((i) => penumbraEdge[i] + (penumbraEdge[3 + i] - penumbraEdge[i]) * 0.97))
  place(labels.moonOrbit, farSideOf(lines['moon-orbit']))
  place(labels.orbitPlane, ORBIT_PLANE_LABEL_AT)
}

// On Earth: the umbra's label on the middle of the shadow, the penumbra's out at its rim.
function placeShadowLabels(spot: ShadowSpot, earth: Sphere, { viewpoint, labels }: OverlayFrame): void {
  const place = (label: HTMLElement, point: ArrayLike<number>) => placeLabel(label, projectToCss(viewpoint, point))
  setText(labels.umbra, 'Umbra: total eclipse')
  setText(labels.penumbra, 'Penumbra: partial eclipse')
  const normal = vec3.normalize(vec3.create(), vec3.subtract(vec3.create(), spot.center, earth.position as Vec3))
  // Northward along the surface: the shadow's rim there stays on the side of Earth facing the Sun.
  const northward = perpendicularUnit([...ECLIPTIC_NORTH], normal)
  place(labels.umbra, spot.center)
  place(labels.penumbra, pointAlong(spot.center, northward, spot.penumbraRadius))
}

// The diagram and the close-up name the shadow's parts differently; rewritten only on a change.
function setText(label: HTMLElement, text: string): void {
  if (label.textContent !== text) label.textContent = text
}
