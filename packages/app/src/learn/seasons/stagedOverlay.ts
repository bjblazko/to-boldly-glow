import { vec3, type mat4 } from 'gl-matrix'
import { projectToCss, type Viewpoint } from '../../camera/viewpoint'
import { placeLabel } from '../../labels/screenLabel'
import { pointAlong, type Vec3 } from '../../math/tuples'
import { tiltedFrameMatrix, type PlanetPose } from '../../scene/sceneLayout'
import {
  directedLinePoints,
  equatorRingPoints,
  greatCircleArcPoints,
  latitudeMarkerCenter,
  latitudeMarkerPoints,
  meridianLongitudeFacing,
  perpendicularComponent,
  rotationAxisPoints,
  sunLeanLabel,
  type SurfaceSpot,
} from './overlayGeometry'
import { OVERLAY_COLORS, OverlayLines } from './overlayLines'
import { subsolarLatitude } from './seasonalPole'
import type { SeasonsLabels } from './seasonsLabels'

const EQUATOR_SEGMENTS = 64
const MARKER_SEGMENTS = 16
const ARC_SEGMENTS = 24

type StagedLineId = 'equator' | 'axis' | 'marker-a' | 'marker-b' | 'reference' | 'tilt-arc' | 'sun-direction'

// Both location markers sit on the meridian facing this world direction - 40 degrees from the Sun
// toward the camera (staged frame: Sun on -X, camera on -Z). Fixed in the world rather than as a
// local longitude, so the markers stay on the sunlit, camera-facing side however the axis is turned.
const MARKER_MERIDIAN_ANGLE_RADIANS = (40 * Math.PI) / 180
const MARKER_MERIDIAN_DIRECTION: Vec3 = [-Math.cos(MARKER_MERIDIAN_ANGLE_RADIANS), 0, -Math.sin(MARKER_MERIDIAN_ANGLE_RADIANS)]

// Overlay sizes relative to Earth's radius. The axis overshoots further than the reference so its
// label stays clear of the reference's even at the equinoxes, where the two lines coincide.
const SURFACE_LINE_SCALE = 1.02
const AXIS_OVERSHOOT = 1.8
const REFERENCE_LENGTH = 1.3
const ARC_RADIUS = 1.15
const RIGHT_ANGLE_LABEL_DISTANCE = 1.2
const MARKER_RADIUS = 0.04
const MARKER_PULSE = 0.15

interface StagedGeometry {
  earthWorld: mat4
  center: Vec3
  pole: Vec3
  sunward: vec3
  reference: Vec3
  spots: [SurfaceSpot, SurfaceSpot]
}

// The staged chapters' diagram on Earth: equator, rotation axis, two locations at +/- the lesson's
// marker latitude, and a small protractor - the axis's "upright as seen from the Sun" reference and
// the arc from it to the axis, whose angle is exactly the subsolar latitude the label prints.
export class StagedOverlay {
  private readonly lines: OverlayLines<StagedLineId>

  constructor(device: GPUDevice, linePipeline: GPURenderPipeline) {
    this.lines = new OverlayLines<StagedLineId>(device, linePipeline, {
      equator: { capacity: EQUATOR_SEGMENTS + 1, color: OVERLAY_COLORS.equator, mode: 'glow' },
      axis: { capacity: 2, color: OVERLAY_COLORS.axis, mode: 'glow' },
      'marker-a': { capacity: MARKER_SEGMENTS + 1, color: [0.37, 0.88, 0.63, 0.95], mode: 'glow' },
      'marker-b': { capacity: MARKER_SEGMENTS + 1, color: [0.45, 0.68, 0.98, 0.95], mode: 'glow' },
      reference: { capacity: 2, color: [0.75, 0.75, 0.8, 0.4], mode: 'solid' },
      'tilt-arc': { capacity: ARC_SEGMENTS + 1, color: OVERLAY_COLORS.arc, mode: 'solid' },
      'sun-direction': { capacity: 2, color: OVERLAY_COLORS.sunDirection, mode: 'solid' },
    })
  }

  update(earth: PlanetPose, markerLatitudeDegrees: number, frame: { viewpoint: Viewpoint; nowSeconds: number; labels: SeasonsLabels }): void {
    const geometry = stagedGeometry(earth, markerLatitudeDegrees)
    const markerRadius = earth.radius * MARKER_RADIUS * (1 + MARKER_PULSE * Math.sin(frame.nowSeconds * 3))
    const lines = this.lineGeometry(earth, geometry, markerRadius)
    this.lines.update(lines, frame.viewpoint, frame.nowSeconds)
    placeLabels(earth, geometry, lines, frame)
  }

  draw(pass: GPURenderPassEncoder): void {
    this.lines.draw(pass)
  }

  private lineGeometry(earth: PlanetPose, geometry: StagedGeometry, markerRadius: number): Record<StagedLineId, Float32Array> {
    const { earthWorld, center, pole, reference, spots } = geometry
    const marker = { radius: markerRadius, segments: MARKER_SEGMENTS }
    return {
      equator: equatorRingPoints(earthWorld, earth.radius * SURFACE_LINE_SCALE, EQUATOR_SEGMENTS),
      axis: rotationAxisPoints(earthWorld, earth.radius, AXIS_OVERSHOOT),
      'marker-a': latitudeMarkerPoints(earthWorld, spots[0], marker),
      'marker-b': latitudeMarkerPoints(earthWorld, spots[1], marker),
      reference: directedLinePoints(center, reference, earth.radius * REFERENCE_LENGTH),
      'tilt-arc': greatCircleArcPoints({ center, from: reference, to: pole, radius: earth.radius * ARC_RADIUS }, ARC_SEGMENTS),
      // Reaches all the way to the Sun at the origin, so it visibly connects to it.
      'sun-direction': new Float32Array([...center, 0, 0, 0]),
    }
  }
}

// Earth's tilt frame without its spin: the overlays stay put while the globe turns underneath.
function stagedGeometry(earth: PlanetPose, markerLatitudeDegrees: number): StagedGeometry {
  const earthWorld = tiltedFrameMatrix(earth)
  const center = earth.position
  const sunward = vec3.normalize(vec3.create(), vec3.negate(vec3.create(), center))
  const reference = perpendicularComponent(earth.poleDirection, [sunward[0], sunward[1], sunward[2]])
  const longitudeDegrees = meridianLongitudeFacing(earth.tilt, MARKER_MERIDIAN_DIRECTION)
  const spot = (latitudeDegrees: number): SurfaceSpot => ({ surfaceRadius: earth.radius * SURFACE_LINE_SCALE, latitudeDegrees, longitudeDegrees })
  return { earthWorld, center, pole: earth.poleDirection, sunward, reference, spots: [spot(markerLatitudeDegrees), spot(-markerLatitudeDegrees)] }
}

function placeLabels(
  earth: PlanetPose,
  geometry: StagedGeometry,
  lines: Record<StagedLineId, Float32Array>,
  frame: { viewpoint: Viewpoint; labels: SeasonsLabels },
): void {
  const { viewpoint, labels } = frame
  const { center, pole, sunward, reference, spots, earthWorld } = geometry
  const place = (label: HTMLElement, point: ArrayLike<number>) => placeLabel(label, projectToCss(viewpoint, point))
  place(labels.locationA, latitudeMarkerCenter(earthWorld, spots[0]))
  place(labels.locationB, latitudeMarkerCenter(earthWorld, spots[1]))
  const arcMidpoint = greatCircleArcPoints({ center, from: reference, to: pole, radius: earth.radius * ARC_RADIUS }, 2).subarray(3, 6)
  labels.tilt.textContent = sunLeanLabel(subsolarLatitude(pole, sunward))
  place(labels.tilt, arcMidpoint)
  // Each line's label sits on the line itself: the axis's north end, a point on the equator, the
  // reference's upper end. "Toward the Sun" sits a short way out rather than at the Sun itself.
  place(labels.axis, lines.axis.subarray(3, 6))
  place(labels.equator, lines.equator.subarray(0, 3))
  place(labels.reference, lines.reference.subarray(3, 6))
  place(labels.towardSun, pointAlong(center, sunward, earth.radius * REFERENCE_LENGTH))
  // The reference is perpendicular to the Sun direction by construction, so the 90 degrees is stated
  // rather than left to judge from a drawing that perspective can skew.
  const bisector = vec3.normalize(vec3.create(), vec3.add(vec3.create(), sunward, reference))
  place(labels.rightAngle, pointAlong(center, bisector, earth.radius * RIGHT_ANGLE_LABEL_DISTANCE))
}
