import { vec3 } from 'gl-matrix'
import { projectToCss, type Viewpoint } from '../../camera/viewpoint'
import { placeLabel } from '../../labels/screenLabel'
import { pointAlong, type Vec3 } from '../../math/tuples'
import type { MoonPose, SceneLayout } from '../../scene/sceneLayout'
import { moonFlatOrbitPosition } from '../../solarSystem/moonOrbit'
import { ECLIPTIC_NORTH } from '../../solarSystem/poleOrientation'
import { EARTH_RADIUS, MOON_ORBIT_RADIUS, MOON_ORBIT_TILT_DEGREES, moonOrbitTilt, shadowEdgeLines } from '../eclipse/eclipseGeometry'
import { OVERLAY_COLORS, OverlayLines } from '../seasons/overlayLines'
import type { PhasesChapterKind } from '../lessonTypes'
import { FLAT_ORBIT, PHASES_EARTH_POSITION, phasesMoonPosition, PHASES_NODE_DEGREES } from './phasesGeometry'
import { PHASE_LABEL_AGES, type PhasesLabels } from './phasesLabels'

const ORBIT_SEGMENTS = 96
// Sunlight comes in from the left: arrows across the Sun-Earth line, just short of the Moon's orbit.
const SUNLIGHT_ROWS = [-8, -4, 0, 4, 8]
const SUNLIGHT_FROM_X = PHASES_EARTH_POSITION[0] - MOON_ORBIT_RADIUS - 5
const SUNLIGHT_TO_X = PHASES_EARTH_POSITION[0] - MOON_ORBIT_RADIUS - 1.6
const ARROW_HEAD = 0.5
// The phase names stand this far outside the Moon's orbit.
const PHASE_LABEL_OFFSET = 2.4
// Earth's shadow is drawn from Earth on (its umbra narrows to a point far beyond the picture).
const SHADOW_REACH = PHASES_EARTH_POSITION[0] + 20
const NEAR_SIDE_MARKER_LENGTH = 3.4

type SunlightId = 'sun-0' | 'sun-1' | 'sun-2' | 'sun-3' | 'sun-4'
type ShadowId = 'umbra-upper' | 'umbra-lower'

interface OverlayFrame {
  viewpoint: Viewpoint
  nowSeconds: number
  labels: PhasesLabels
  showNearSide: boolean
}

// The space chapters' construction lines and labels: from above, the Moon's orbit, the sunlight
// arriving from the left and the four main phases; from the side, Earth's shadow - its dark core, the
// umbra, which is what would darken the Moon - and the Moon's tilted orbit; and, on request, a
// marker on the middle of the Moon's near side.
export class PhasesOverlay {
  private readonly orbit: OverlayLines<'orbit'>
  private readonly sunlight: OverlayLines<SunlightId>
  private readonly shadow: OverlayLines<ShadowId>
  private readonly nearSide: OverlayLines<'near-side'>
  private readonly sunlightPoints = sunlightArrows()
  private shown: OverlayLines<string>[] = []

  constructor(device: GPUDevice, linePipeline: GPURenderPipeline) {
    this.orbit = new OverlayLines(device, linePipeline, { orbit: { capacity: ORBIT_SEGMENTS + 1, color: [0.62, 0.66, 0.78, 1], mode: 'solid' } })
    const arrow = { capacity: 5, color: OVERLAY_COLORS.sunDirection, mode: 'solid' as const }
    this.sunlight = new OverlayLines(device, linePipeline, { 'sun-0': arrow, 'sun-1': arrow, 'sun-2': arrow, 'sun-3': arrow, 'sun-4': arrow })
    const umbra = { capacity: 2, color: [1.0, 0.3, 0.2, 1] as [number, number, number, number], mode: 'solid' as const }
    this.shadow = new OverlayLines(device, linePipeline, { 'umbra-upper': umbra, 'umbra-lower': umbra })
    this.nearSide = new OverlayLines(device, linePipeline, { 'near-side': { capacity: 2, color: OVERLAY_COLORS.axis, mode: 'glow' } })
  }

  update(layout: SceneLayout, kind: PhasesChapterKind, frame: OverlayFrame): void {
    frame.labels.hideAll()
    this.shown = []
    const moon = layout.moons[0]
    if (!moon || kind === 'phasesSky') return
    if (kind === 'phasesOrbit') this.showFromAbove(frame)
    else this.showFromTheSide(layout, frame)
    if (frame.showNearSide) this.showNearSide(moon, frame)
  }

  // Expects the line pipeline to be set on the pass.
  draw(pass: GPURenderPassEncoder): void {
    for (const lines of this.shown) lines.draw(pass)
  }

  private showFromAbove(frame: OverlayFrame): void {
    const orbit = orbitPoints(FLAT_ORBIT)
    this.orbit.update({ orbit }, frame.viewpoint, frame.nowSeconds)
    this.sunlight.update(this.sunlightPoints, frame.viewpoint, frame.nowSeconds)
    this.shown.push(this.orbit, this.sunlight)
    const place = placer(frame.viewpoint)
    place(frame.labels.sunlight, [SUNLIGHT_FROM_X + 1.5, SUNLIGHT_ROWS[SUNLIGHT_ROWS.length - 1] + 1.3, 0])
    PHASE_LABEL_AGES.forEach((age, i) => place(frame.labels.phases[i], outsideOrbit(phasesMoonPosition(age))))
  }

  private showFromTheSide(layout: SceneLayout, frame: OverlayFrame): void {
    const orbit = orbitPoints(MOON_ORBIT_TILT_DEGREES)
    const earth = { position: PHASES_EARTH_POSITION, radius: EARTH_RADIUS }
    const { umbra } = shadowEdgeLines(layout.sun, earth, [...ECLIPTIC_NORTH], SHADOW_REACH)
    const fromEarth = (line: Float32Array) => clipFromX(line, PHASES_EARTH_POSITION[0])
    this.orbit.update({ orbit }, frame.viewpoint, frame.nowSeconds)
    this.shadow.update({ 'umbra-upper': fromEarth(umbra[0]), 'umbra-lower': fromEarth(umbra[1]) }, frame.viewpoint, frame.nowSeconds)
    this.shown.push(this.orbit, this.shadow)
    const place = placer(frame.viewpoint)
    place(frame.labels.earthShadow, [PHASES_EARTH_POSITION[0] + 11, 0, 0])
    place(frame.labels.moonOrbit, farSideOf(orbit))
  }

  // From the Moon's center out through the middle of its near side: the face it always turns to Earth.
  private showNearSide(moon: MoonPose, frame: OverlayFrame): void {
    const face = nearSideDirection(moon)
    const start = pointAlong(moon.position, face, moon.radius)
    const end = pointAlong(moon.position, face, moon.radius * NEAR_SIDE_MARKER_LENGTH)
    this.nearSide.update({ 'near-side': new Float32Array([...start, ...end]) }, frame.viewpoint, frame.nowSeconds)
    this.shown.push(this.nearSide)
    placer(frame.viewpoint)(frame.labels.nearSide, pointAlong(moon.position, face, moon.radius * (NEAR_SIDE_MARKER_LENGTH + 1.6)))
  }
}

// The Moon's near side faces local -Y once its spin and tilt are applied (see moonOrbit.ts's
// MOON_SUB_PARENT_SPIN_OFFSET_RADIANS) - straight at Earth, which is the point of the chapter.
export function nearSideDirection(moon: MoonPose): Vec3 {
  const local: Vec3 = [Math.sin(moon.spinRadians), -Math.cos(moon.spinRadians), 0]
  const world = vec3.transformMat4(vec3.create(), local, moon.tilt)
  return [world[0], world[1], world[2]]
}

function placer(viewpoint: Viewpoint) {
  return (label: HTMLElement, point: ArrayLike<number>) => placeLabel(label, projectToCss(viewpoint, point))
}

function orbitPoints(tiltDegrees: number): Float32Array {
  const tilt = moonOrbitTilt(PHASES_NODE_DEGREES, tiltDegrees)
  const points = new Float32Array((ORBIT_SEGMENTS + 1) * 3)
  for (let i = 0; i <= ORBIT_SEGMENTS; i++) {
    const tilted = vec3.transformMat4(vec3.create(), moonFlatOrbitPosition(MOON_ORBIT_RADIUS, (i / ORBIT_SEGMENTS) * 2 * Math.PI), tilt)
    points.set([PHASES_EARTH_POSITION[0] + tilted[0], PHASES_EARTH_POSITION[1] + tilted[1], PHASES_EARTH_POSITION[2] + tilted[2]], i * 3)
  }
  return points
}

function outsideOrbit(position: Vec3): Vec3 {
  const outward = vec3.normalize(vec3.create(), [position[0] - PHASES_EARTH_POSITION[0], position[1] - PHASES_EARTH_POSITION[1], position[2] - PHASES_EARTH_POSITION[2]])
  return pointAlong(position, outward, PHASE_LABEL_OFFSET)
}

function farSideOf(orbit: Float32Array): Vec3 {
  let best = 0
  for (let i = 3; i < orbit.length; i += 3) if (orbit[i] > orbit[best]) best = i
  return [orbit[best], orbit[best + 1], orbit[best + 2]]
}

// A shaft along +X with an arrowhead at its tip, per row.
function sunlightArrows(): Record<SunlightId, Float32Array> {
  const arrow = (y: number) =>
    new Float32Array([SUNLIGHT_FROM_X, y, 0, SUNLIGHT_TO_X, y, 0, SUNLIGHT_TO_X - ARROW_HEAD, y + ARROW_HEAD, 0, SUNLIGHT_TO_X, y, 0, SUNLIGHT_TO_X - ARROW_HEAD, y - ARROW_HEAD, 0])
  return Object.fromEntries(SUNLIGHT_ROWS.map((y, i) => [`sun-${i}`, arrow(y)])) as Record<SunlightId, Float32Array>
}

// The part of a two-point line beyond `x` (the shadow behind Earth, not the light before it).
function clipFromX(line: Float32Array, x: number): Float32Array {
  const t = (x - line[0]) / (line[3] - line[0])
  return new Float32Array([...[0, 1, 2].map((i) => line[i] + (line[3 + i] - line[i]) * t), line[3], line[4], line[5]])
}
