import { vec3 } from 'gl-matrix'
import { AU_KM } from '../solarSystem/bodies'
import { entityPoleDirection, entityWorldPosition, type SolarSystemEntity } from '../solarSystem/entities'
import { scaledBodyRadiusUnits } from '../solarSystem/sceneScale'
import { orbitBasisForUpAxis, type OrbitBasis, type OrbitCamera } from './orbitCamera'
import { easeInOutCubic, lerp, lerpAngle, lerpVec3 } from './easing'

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

interface FlyToTween {
  startTarget: [number, number, number]
  startRadius: number
  startAzimuth: number
  startElevation: number
  startUpAxis: [number, number, number]
  endTarget: [number, number, number]
  endRadius: number
  endAzimuth: number
  endElevation: number
  endUpAxis: [number, number, number]
  elapsedSeconds: number
  durationSeconds: number
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
// (right, forward0) frame for whichever up-axis is in effect when this is called - see
// orbitBasisForUpAxis in orbitCamera.ts.
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
  followedEntityId: string | null = null
  private followedEntity: SolarSystemEntity | null = null
  private flyTo: FlyToTween | null = null
  private readonly flyToDurationSeconds: number
  // The framing radius (see defaultFramingRadius) the camera's current radius was last rescaled
  // for. Realistic/Compact endpoints put a body's rendered radius orders of magnitude apart (see
  // geometricBlend in sceneScale.ts) - without rescaling orbitCamera.radius by how much this
  // reference framing radius itself changes as scaleBlend animates, a followed body shrinks to an
  // invisible speck (Compact -> Realistic) or swells past the camera (Realistic -> Compact) while
  // the camera's distance to it stays fixed at whatever it was framed for before the toggle.
  private lastFramingRadius: number | null = null

  constructor(
    private readonly orbitCamera: OrbitCamera,
    options: CameraFollowOptions = {},
  ) {
    this.flyToDurationSeconds = options.flyToDurationSeconds ?? 1.5
  }

  selectEntity(entity: SolarSystemEntity, T: number, daysSinceEpoch: number, scaleBlend: number): void {
    const startTarget: [number, number, number] = [
      this.orbitCamera.target[0],
      this.orbitCamera.target[1],
      this.orbitCamera.target[2],
    ]
    const startUpAxis: [number, number, number] = [
      this.orbitCamera.upAxis[0],
      this.orbitCamera.upAxis[1],
      this.orbitCamera.upAxis[2],
    ]
    this.followedEntity = entity
    this.followedEntityId = entity.id
    const endTarget = entityWorldPosition(entity, T, daysSinceEpoch, scaleBlend)
    const basis = orbitBasisForUpAxis(startUpAxis)
    const endRadius = defaultFramingRadius(entity, scaleBlend, this.orbitCamera)
    this.flyTo = {
      startTarget,
      startRadius: this.orbitCamera.radius,
      startAzimuth: this.orbitCamera.azimuth,
      startElevation: this.orbitCamera.elevation,
      startUpAxis,
      endTarget,
      endRadius,
      endAzimuth: defaultFramingAzimuth(endTarget, this.orbitCamera.azimuth, basis),
      endElevation: this.orbitCamera.elevation,
      endUpAxis: entityPoleDirection(entity),
      elapsedSeconds: 0,
      durationSeconds: this.flyToDurationSeconds,
    }
    this.lastFramingRadius = endRadius
  }

  // Entity-independent counterpart to selectEntity: flies to a fixed, caller-supplied framing
  // (target/radius/azimuth/elevation/upAxis) instead of one derived from a SolarSystemEntity's
  // live position/pole. Used by learn-mode chapter framing, where the initial target is Earth's
  // position on the chapter's defining date - main.ts's per-frame render loop separately keeps
  // the target re-centered on Earth's actual scrub-driven position once in learn mode (see
  // isLearnEarth in main.ts), so this tween only needs to get radius/azimuth/elevation/upAxis
  // into place. Explicitly clears followedEntity/followedEntityId (like stopFollowing() does)
  // before starting the tween: without this, a stale entity-follow left over from a search
  // selection made before entering learn mode would silently re-engage update()'s live-tracking
  // branch the moment this tween completes, hijacking the camera away from the locked chapter
  // framing.
  flyToFraming(
    endTarget: [number, number, number],
    endRadius: number,
    endAzimuth: number,
    endElevation: number,
    endUpAxis: [number, number, number],
    durationSeconds?: number,
  ): void {
    const startTarget: [number, number, number] = [
      this.orbitCamera.target[0],
      this.orbitCamera.target[1],
      this.orbitCamera.target[2],
    ]
    const startUpAxis: [number, number, number] = [
      this.orbitCamera.upAxis[0],
      this.orbitCamera.upAxis[1],
      this.orbitCamera.upAxis[2],
    ]
    this.followedEntityId = null
    this.followedEntity = null
    this.lastFramingRadius = null
    this.flyTo = {
      startTarget,
      startRadius: this.orbitCamera.radius,
      startAzimuth: this.orbitCamera.azimuth,
      startElevation: this.orbitCamera.elevation,
      startUpAxis,
      endTarget,
      endRadius,
      endAzimuth,
      endElevation,
      endUpAxis,
      elapsedSeconds: 0,
      durationSeconds: durationSeconds ?? this.flyToDurationSeconds,
    }
  }

  stopFollowing(): void {
    this.followedEntityId = null
    this.followedEntity = null
    this.lastFramingRadius = null
    this.flyTo = null
  }

  // True while a flyToFraming/selectEntity tween is still interpolating toward its end framing.
  // Lets callers (main.ts's learn-mode target re-centering) avoid stomping on the tween's own
  // per-frame target interpolation with a competing direct assignment to orbitCamera.target.
  get isFlying(): boolean {
    return this.flyTo !== null
  }

  update(deltaSeconds: number, T: number, daysSinceEpoch: number, scaleBlend: number): void {
    if (this.flyTo) {
      this.flyTo.elapsedSeconds += deltaSeconds
      const t = Math.min(this.flyTo.elapsedSeconds / this.flyTo.durationSeconds, 1)
      const eased = easeInOutCubic(t)
      vec3.copy(this.orbitCamera.target, lerpVec3(this.flyTo.startTarget, this.flyTo.endTarget, eased))
      this.orbitCamera.radius = lerp(this.flyTo.startRadius, this.flyTo.endRadius, eased)
      this.orbitCamera.azimuth = lerpAngle(this.flyTo.startAzimuth, this.flyTo.endAzimuth, eased)
      this.orbitCamera.elevation = lerp(this.flyTo.startElevation, this.flyTo.endElevation, eased)
      const upAxis = vec3.create()
      // vec3.slerp computes angle = acos(dot(a, b)) then divides by sin(angle); when start and end
      // are (nearly) the same vector, sin(angle) is ~0 and the division produces NaN - a real bug
      // hit in production, since OrbitCamera defaults its up-axis to ECLIPTIC_NORTH and every
      // learn-mode chapter flies to ECLIPTIC_NORTH too, so the very first learn-mode fly-to always
      // tweens "from ECLIPTIC_NORTH to ECLIPTIC_NORTH" - an exact-match pair. There's nothing to
      // interpolate when start and end are the same direction anyway, so skip slerp entirely and
      // copy the (identical) endpoint directly.
      if (vec3.dot(this.flyTo.startUpAxis, this.flyTo.endUpAxis) > 0.9999999) {
        vec3.copy(upAxis, this.flyTo.endUpAxis)
      } else {
        vec3.slerp(upAxis, this.flyTo.startUpAxis, this.flyTo.endUpAxis, eased)
      }
      vec3.copy(this.orbitCamera.upAxis, upAxis)
      if (t >= 1) this.flyTo = null
      return
    }

    if (this.followedEntity) {
      const livePosition = entityWorldPosition(this.followedEntity, T, daysSinceEpoch, scaleBlend)
      const currentTarget: [number, number, number] = [
        this.orbitCamera.target[0],
        this.orbitCamera.target[1],
        this.orbitCamera.target[2],
      ]
      vec3.copy(this.orbitCamera.target, lerpVec3(currentTarget, livePosition, followSmoothingFactor(deltaSeconds)))

      // Rescale the camera's distance by however much the reference framing radius itself moved
      // since last frame, so a Realistic<->Compact toggle (or its animated tween) keeps the
      // followed body framed the same way instead of shrinking to a speck or blowing out past the
      // camera - see lastFramingRadius's own comment. Multiplicative rescaling (rather than
      // snapping straight to the new framing radius) preserves any zoom the user dialed in by hand.
      const currentFramingRadius = defaultFramingRadius(this.followedEntity, scaleBlend, this.orbitCamera)
      if (this.lastFramingRadius !== null && this.lastFramingRadius > 0) {
        this.orbitCamera.radius *= currentFramingRadius / this.lastFramingRadius
      }
      this.lastFramingRadius = currentFramingRadius
    }
  }
}
