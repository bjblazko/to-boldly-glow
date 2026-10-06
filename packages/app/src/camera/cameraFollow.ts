import { vec3 } from 'gl-matrix'
import { AU_KM } from '../solarSystem/bodies'
import { entityPoleDirection, entityWorldPosition, type SolarSystemEntity } from '../solarSystem/entities'
import { scaledBodyRadiusUnits } from '../solarSystem/sceneScale'
import { orbitBasisForUpAxis, type OrbitBasis, type OrbitCamera } from './orbitCamera'
import { easeInOutCubic, lerp, lerpAngle, lerpVec3 } from '../math/easing'

export interface CameraFollowOptions {
  flyToDurationSeconds?: number
}

// How many body-radii away the default fly-to framing sits, so small moons get a close-up view
// and large bodies (the Sun, Jupiter) get a farther one, all clamped to the camera's own zoom range.
const FRAMING_RADIUS_MULTIPLIER = 6

// Controls how quickly the locked-on camera eases toward a followed entity's live position each
// frame, rather than snapping to it exactly. Framerate-independent exponential smoothing (see
// followSmoothingFactor) - closes ~95% of the gap within about 0.3 real seconds at this rate.
// Needed because a fast-orbiting moon under time acceleration can move a large distance between
// frames; snapping straight to its exact position every frame whips the camera through that same
// fast motion, which reads as chaotic rather than as smooth tracking.
const FOLLOW_SMOOTHING_RATE = 10

// Fraction of the remaining gap to a target value to close within `deltaSeconds` of real time,
// independent of frame rate (unlike a fixed per-frame lerp factor, which would converge slower on
// slower frame rates and faster on faster ones for the same nominal factor).
function followSmoothingFactor(deltaSeconds: number): number {
  return 1 - Math.exp(-FOLLOW_SMOOTHING_RATE * deltaSeconds)
}

// Everything that places the orbit camera.
interface OrbitPose {
  target: [number, number, number]
  radius: number
  azimuth: number
  elevation: number
  upAxis: [number, number, number]
}

interface FlyToTween {
  from: OrbitPose
  to: OrbitPose
  elapsedSeconds: number
  durationSeconds: number
}

function poseOf(camera: OrbitCamera): OrbitPose {
  const { target, radius, azimuth, elevation, upAxis } = camera
  return { target: [target[0], target[1], target[2]], radius, azimuth, elevation, upAxis: [upAxis[0], upAxis[1], upAxis[2]] }
}

// Along the great circle between two unit up-axes, at a bounded angular rate even for nearly
// opposite axes (lerp + normalize swings wildly there). vec3.slerp divides by sin(angle), which is
// 0 for identical axes, so those are returned as they are.
export function interpolateUpAxis(from: readonly [number, number, number], to: readonly [number, number, number], t: number): vec3 {
  if (vec3.dot(from, to) > 0.9999999) return vec3.fromValues(...to)
  return vec3.slerp(vec3.create(), from, to, t)
}

function applyInterpolatedPose(camera: OrbitCamera, { from, to }: FlyToTween, eased: number): void {
  vec3.copy(camera.target, lerpVec3(from.target, to.target, eased))
  camera.radius = lerp(from.radius, to.radius, eased)
  camera.azimuth = lerpAngle(from.azimuth, to.azimuth, eased)
  camera.elevation = lerp(from.elevation, to.elevation, eased)
  vec3.copy(camera.upAxis, interpolateUpAxis(from.upAxis, to.upAxis, eased))
}

function defaultFramingRadius(entity: SolarSystemEntity, scaleBlend: number, camera: OrbitCamera): number {
  const { radiusKm, compactVisualRadius } = entity.definition
  const bodyRadius = scaledBodyRadiusUnits(radiusKm, compactVisualRadius, scaleBlend, AU_KM)
  const framing = bodyRadius * FRAMING_RADIUS_MULTIPLIER
  return Math.min(Math.max(framing, camera.minRadius), camera.maxRadius)
}

// Azimuth (horizontal facing direction, relative to the given up-axis basis) that positions the
// camera's eye roughly on the Sun's side of the target, so the flight ends looking at a sunlit
// face rather than a silhouette. Only reorients azimuth, not elevation - elevation stays whatever
// the user had. Falls back to the given azimuth when the target is at the origin (the Sun
// itself), where there's no meaningful "direction toward the Sun" to face. `basis` must be the
// (right, forward0) frame of the up-axis the returned azimuth will be USED with - see
// orbitBasisForUpAxis in orbitCamera.ts. For a fly-to that is the destination's up-axis, not the
// one in effect when the flight starts: OrbitCamera interprets azimuth in its current up-axis's
// basis, so an azimuth computed in the starting basis lands the eye somewhere else once upAxis
// has turned to a tilted pole (e.g. Earth/Neptune ended up looking at the terminator side-on).
export function defaultFramingAzimuth(
  targetPosition: readonly [number, number, number],
  fallbackAzimuth: number,
  basis: OrbitBasis,
): number {
  const [tx, ty, tz] = targetPosition
  if (Math.hypot(tx, ty, tz) < 1e-9) return fallbackAzimuth
  const toEye: [number, number, number] = [-tx, -ty, -tz]
  const rightComponent = toEye[0] * basis.right[0] + toEye[1] * basis.right[1] + toEye[2] * basis.right[2]
  const forwardComponent = toEye[0] * basis.forward0[0] + toEye[1] * basis.forward0[1] + toEye[2] * basis.forward0[2]
  return Math.atan2(rightComponent, forwardComponent)
}

// Flies the camera to a selected entity, then keeps OrbitCamera.target locked onto its live world
// position every frame - as it moves along its orbit and/or spins - without touching
// azimuth/elevation/radius, so manual drag/zoom keep working normally around the moving target.
export class CameraFollowController {
  private followedEntity: SolarSystemEntity | null = null
  private flyTo: FlyToTween | null = null
  private readonly flyToDurationSeconds: number
  // The framing radius (see defaultFramingRadius) the camera's distance was last scaled for. The
  // Realistic and Compact sizes of a body differ by orders of magnitude, so while the scale blend
  // animates, the camera's distance is rescaled by how much this reference changed - otherwise a
  // followed body shrinks to a speck or swells past the camera.
  private lastFramingRadius: number | null = null

  constructor(
    private readonly orbitCamera: OrbitCamera,
    options: CameraFollowOptions = {},
  ) {
    this.flyToDurationSeconds = options.flyToDurationSeconds ?? 1.5
  }

  get followedEntityId(): string | null {
    return this.followedEntity?.id ?? null
  }

  // Ends on the entity's sunlit side, with the camera's up turned to the entity's own pole.
  selectEntity(entity: SolarSystemEntity, T: number, daysSinceEpoch: number, scaleBlend: number): void {
    const from = poseOf(this.orbitCamera)
    const target = entityWorldPosition(entity, T, daysSinceEpoch, scaleBlend)
    const upAxis = entityPoleDirection(entity)
    const radius = defaultFramingRadius(entity, scaleBlend, this.orbitCamera)
    const azimuth = defaultFramingAzimuth(target, from.azimuth, orbitBasisForUpAxis(upAxis))
    this.followedEntity = entity
    this.flyTo = { from, to: { target, radius, azimuth, elevation: from.elevation, upAxis }, elapsedSeconds: 0, durationSeconds: this.flyToDurationSeconds }
    this.lastFramingRadius = radius
  }

  stopFollowing(): void {
    this.followedEntity = null
    this.lastFramingRadius = null
    this.flyTo = null
  }

  update(deltaSeconds: number, T: number, daysSinceEpoch: number, scaleBlend: number): void {
    if (this.flyTo) this.advanceFlyTo(this.flyTo, deltaSeconds, () => this.livePosition(T, daysSinceEpoch, scaleBlend))
    else if (this.followedEntity) this.track(this.followedEntity, deltaSeconds, { T, daysSinceEpoch, scaleBlend })
  }

  private livePosition(T: number, daysSinceEpoch: number, scaleBlend: number): [number, number, number] | null {
    return this.followedEntity ? entityWorldPosition(this.followedEntity, T, daysSinceEpoch, scaleBlend) : null
  }

  // Aims at the entity's live position, not where it was when the flight began: under time
  // acceleration a body travels far during the flight (Mercury covers a sixth of its orbit at
  // 1 month/s), and the camera used to arrive at empty space and then lurch after it.
  private advanceFlyTo(flyTo: FlyToTween, deltaSeconds: number, livePosition: () => [number, number, number] | null): void {
    flyTo.to.target = livePosition() ?? flyTo.to.target
    flyTo.elapsedSeconds += deltaSeconds
    const t = Math.min(flyTo.elapsedSeconds / flyTo.durationSeconds, 1)
    applyInterpolatedPose(this.orbitCamera, flyTo, easeInOutCubic(t))
    if (t >= 1) this.flyTo = null
  }

  // Eases toward the entity's live position (snapping would whip the camera through a fast moon's
  // motion) and keeps the framing proportional while the scale blend changes. Rescaling rather
  // than snapping to the new framing radius preserves any zoom the user dialed in by hand.
  private track(entity: SolarSystemEntity, deltaSeconds: number, moment: { T: number; daysSinceEpoch: number; scaleBlend: number }): void {
    const livePosition = entityWorldPosition(entity, moment.T, moment.daysSinceEpoch, moment.scaleBlend)
    const target = this.orbitCamera.target
    vec3.copy(target, lerpVec3([target[0], target[1], target[2]], livePosition, followSmoothingFactor(deltaSeconds)))
    const framingRadius = defaultFramingRadius(entity, moment.scaleBlend, this.orbitCamera)
    if (this.lastFramingRadius !== null && this.lastFramingRadius > 0) this.orbitCamera.radius *= framingRadius / this.lastFramingRadius
    this.lastFramingRadius = framingRadius
  }
}
