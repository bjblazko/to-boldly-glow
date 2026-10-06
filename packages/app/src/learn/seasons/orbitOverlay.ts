import { vec3 } from 'gl-matrix'
import { projectToCss, type Viewpoint } from '../../camera/viewpoint'
import { placeLabel } from '../../labels/screenLabel'
import { pointAlong, type Vec3 } from '../../math/tuples'
import { tiltedFrameMatrix, type PlanetPose } from '../../scene/sceneLayout'
import { directedLinePoints, equatorRingPoints, greatCircleArcPoints, orbitPathCirclePoints, perpendicularComponent, sunLeanLabel } from './overlayGeometry'
import { OVERLAY_COLORS, OverlayLines } from './overlayLines'
import { ORBIT_FIXED_POLE_DIRECTION, subsolarLatitude } from './seasonalPole'
import type { SeasonsLabels } from './seasonsLabels'
import { ORBIT_PATH_RADIUS } from './seasonsScene'

const PATH_SEGMENTS = 64
const EQUATOR_SEGMENTS = 64
const ARC_SEGMENTS = 24

type OrbitLineId = 'orbit-path' | 'orbit-axis' | 'orbit-equator' | 'orbit-reference' | 'orbit-arc' | 'orbit-sun-direction'

// Overlay sizes relative to Earth's radius. The axis is longest so its label stays clear of the
// others even when foreshortening bunches the lines together on screen.
const AXIS_LENGTH = 5.5
const REFERENCE_LENGTH = 4
const ARC_RADIUS = 3
const EQUATOR_SCALE = 1.02
const RIGHT_ANGLE_LABEL_DISTANCE = REFERENCE_LENGTH * 0.55

interface OrbitGeometry {
  position: Vec3
  sunwardUnit: Vec3
  sunDistance: number
  // The fixed axis's component perpendicular to the Sun line: where an untilted axis would point,
  // the zero the arc and the printed angle measure from.
  reference: Vec3
}

// The orbit chapter's construction: Earth's compact orbit path, its fixed axis and equator, the
// "untilted" reference perpendicular to the Sun line, the arc from it to the axis, and the Sun line.
export class OrbitOverlay {
  private readonly lines: OverlayLines<OrbitLineId>
  private readonly pathPoints = orbitPathCirclePoints(ORBIT_PATH_RADIUS, PATH_SEGMENTS)

  constructor(device: GPUDevice, linePipeline: GPURenderPipeline) {
    this.lines = new OverlayLines<OrbitLineId>(device, linePipeline, {
      'orbit-path': { capacity: PATH_SEGMENTS + 1, color: [0.5, 0.5, 0.55, 0.5], mode: 'solid' },
      'orbit-axis': { capacity: 2, color: OVERLAY_COLORS.axis, mode: 'glow' },
      'orbit-equator': { capacity: EQUATOR_SEGMENTS + 1, color: OVERLAY_COLORS.equator, mode: 'glow' },
      'orbit-reference': { capacity: 2, color: [0.3, 0.7, 1.0, 0.95], mode: 'glow' },
      'orbit-arc': { capacity: ARC_SEGMENTS + 1, color: OVERLAY_COLORS.arc, mode: 'solid' },
      'orbit-sun-direction': { capacity: 2, color: OVERLAY_COLORS.sunDirection, mode: 'solid' },
    })
  }

  update(earth: PlanetPose, frame: { viewpoint: Viewpoint; nowSeconds: number; labels: SeasonsLabels }): void {
    const geometry = orbitGeometry(earth)
    const lines = this.lineGeometry(earth, geometry)
    this.lines.update(lines, frame.viewpoint, frame.nowSeconds)
    placeLabels(earth, geometry, lines, frame)
  }

  draw(pass: GPURenderPassEncoder): void {
    this.lines.draw(pass)
  }

  private lineGeometry(earth: PlanetPose, { position, sunwardUnit, sunDistance, reference }: OrbitGeometry): Record<OrbitLineId, Float32Array> {
    return {
      'orbit-path': this.pathPoints,
      'orbit-axis': directedLinePoints(position, ORBIT_FIXED_POLE_DIRECTION, earth.radius * AXIS_LENGTH),
      // Earth's tilt frame without its spin, so the ring stays put while the globe turns.
      'orbit-equator': equatorRingPoints(tiltedFrameMatrix(earth), earth.radius * EQUATOR_SCALE, EQUATOR_SEGMENTS),
      'orbit-reference': directedLinePoints(position, reference, earth.radius * REFERENCE_LENGTH),
      'orbit-arc': greatCircleArcPoints(arc(earth, position, reference), ARC_SEGMENTS),
      // Reaches all the way to the Sun, so it visibly connects to it.
      'orbit-sun-direction': new Float32Array([...position, ...pointAlong(position, sunwardUnit, sunDistance)]),
    }
  }
}

function orbitGeometry(earth: PlanetPose): OrbitGeometry {
  const position = earth.position
  const sunward: Vec3 = [-position[0], -position[1], -position[2]]
  const sunDistance = Math.hypot(...sunward)
  const sunwardUnit: Vec3 = sunDistance > 1e-6 ? [sunward[0] / sunDistance, sunward[1] / sunDistance, sunward[2] / sunDistance] : [0, 0, 0]
  return { position, sunwardUnit, sunDistance, reference: perpendicularComponent(ORBIT_FIXED_POLE_DIRECTION, sunward) }
}

function arc(earth: PlanetPose, position: Vec3, reference: Vec3) {
  return { center: position, from: reference, to: ORBIT_FIXED_POLE_DIRECTION, radius: earth.radius * ARC_RADIUS }
}

function placeLabels(
  earth: PlanetPose,
  geometry: OrbitGeometry,
  lines: Record<OrbitLineId, Float32Array>,
  frame: { viewpoint: Viewpoint; labels: SeasonsLabels },
): void {
  const { viewpoint, labels } = frame
  const { position, sunwardUnit, reference } = geometry
  const place = (label: HTMLElement, point: ArrayLike<number>) => placeLabel(label, projectToCss(viewpoint, point))
  labels.hideLocations()
  // The arc sweeps from the reference to the axis, so its angle is the subsolar latitude; the sign
  // says whether the north end leans toward or away from the Sun.
  labels.tilt.textContent = sunLeanLabel(subsolarLatitude(ORBIT_FIXED_POLE_DIRECTION, sunwardUnit))
  place(labels.tilt, greatCircleArcPoints(arc(earth, position, reference), 2).subarray(3, 6))
  place(labels.axis, lines['orbit-axis'].subarray(3, 6))
  place(labels.equator, lines['orbit-equator'].subarray(0, 3))
  place(labels.reference, lines['orbit-reference'].subarray(3, 6))
  place(labels.towardSun, pointAlong(position, sunwardUnit, earth.radius * REFERENCE_LENGTH))
  const bisector = vec3.normalize(vec3.create(), vec3.add(vec3.create(), sunwardUnit, reference))
  place(labels.rightAngle, pointAlong(position, bisector, earth.radius * RIGHT_ANGLE_LABEL_DISTANCE))
}
