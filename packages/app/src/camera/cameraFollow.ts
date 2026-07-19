import { vec3 } from 'gl-matrix'
import { AU_KM } from '../solarSystem/bodies'
import { entityWorldPosition, type SolarSystemEntity } from '../solarSystem/entities'
import { scaledBodyRadiusUnits } from '../solarSystem/sceneScale'
import type { OrbitCamera } from './orbitCamera'
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
  endTarget: [number, number, number]
  endRadius: number
  endAzimuth: number
  elapsedSeconds: number
  durationSeconds: number
}

function defaultFramingRadius(entity: SolarSystemEntity, scaleBlend: number, camera: OrbitCamera): number {
  const { radiusKm, explorerVisualRadius } = entity.definition
  const bodyRadius = scaledBodyRadiusUnits(radiusKm, explorerVisualRadius, scaleBlend, AU_KM)
  const framing = bodyRadius * FRAMING_RADIUS_MULTIPLIER
  return Math.min(Math.max(framing, camera.minRadius), camera.maxRadius)
}

// Azimuth (horizontal facing direction) that positions the camera's eye roughly on the Sun's side
// of the target, so the flight ends looking at a sunlit face rather than a silhouette. Only
// reorients azimuth, not elevation - elevation stays whatever the user had, since deriving a
// correct default elevation would require resolving which scene axis is "ecliptic north" (a
// separate, not-yet-settled question). Falls back to the given azimuth when the target is at the
// origin (the Sun itself), where there's no meaningful "direction toward the Sun" to face.
export function defaultFramingAzimuth(targetPosition: readonly [number, number, number], fallbackAzimuth: number): number {
  const [tx, , tz] = targetPosition
  if (Math.abs(tx) < 1e-9 && Math.abs(tz) < 1e-9) return fallbackAzimuth
  return Math.atan2(-tx, -tz)
}

// Flies the camera to a selected entity, then keeps OrbitCamera.target locked onto its live world
// position every frame - as it moves along its orbit and/or spins - without touching
// azimuth/elevation/radius, so manual drag/zoom keep working normally around the moving target.
export class CameraFollowController {
  followedEntityId: string | null = null
  private followedEntity: SolarSystemEntity | null = null
  private flyTo: FlyToTween | null = null
  private readonly flyToDurationSeconds: number

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
    this.followedEntity = entity
    this.followedEntityId = entity.id
    const endTarget = entityWorldPosition(entity, T, daysSinceEpoch, scaleBlend)
    this.flyTo = {
      startTarget,
      startRadius: this.orbitCamera.radius,
      startAzimuth: this.orbitCamera.azimuth,
      endTarget,
      endRadius: defaultFramingRadius(entity, scaleBlend, this.orbitCamera),
      endAzimuth: defaultFramingAzimuth(endTarget, this.orbitCamera.azimuth),
      elapsedSeconds: 0,
      durationSeconds: this.flyToDurationSeconds,
    }
  }

  stopFollowing(): void {
    this.followedEntityId = null
    this.followedEntity = null
    this.flyTo = null
  }

  update(deltaSeconds: number, T: number, daysSinceEpoch: number, scaleBlend: number): void {
    if (this.flyTo) {
      this.flyTo.elapsedSeconds += deltaSeconds
      const t = Math.min(this.flyTo.elapsedSeconds / this.flyTo.durationSeconds, 1)
      const eased = easeInOutCubic(t)
      vec3.copy(this.orbitCamera.target, lerpVec3(this.flyTo.startTarget, this.flyTo.endTarget, eased))
      this.orbitCamera.radius = lerp(this.flyTo.startRadius, this.flyTo.endRadius, eased)
      this.orbitCamera.azimuth = lerpAngle(this.flyTo.startAzimuth, this.flyTo.endAzimuth, eased)
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
    }
  }
}
