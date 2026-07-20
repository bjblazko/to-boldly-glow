import { mat4, vec3 } from 'gl-matrix'
import { geometricBlend } from '../solarSystem/sceneScale'
import { ECLIPTIC_NORTH } from '../solarSystem/poleOrientation'

// The Compact-mode zoom-in floor (matches OrbitCamera's own default minRadius) was tuned for
// Compact-scale body sizes (~0.1-3 scene units). At Realistic scale (blend=0), body/moon radii
// and moon-orbit distances shrink into the ~0.0001-0.09 unit range (see sceneScale.ts/
// moonOrbit.ts's geometricBlend endpoints), so a fixed 5-unit floor makes it impossible to zoom
// close enough to tell any two nearby bodies apart - e.g. the Moon's entire real orbit around
// Earth (~0.05 units) is roughly 100x smaller than this floor, so the camera can never get closer
// to Earth than 100x the Earth-Moon distance itself. REALISTIC_MIN_ORBIT_RADIUS is chosen below
// the smallest default fly-to framing distance among all rendered bodies at blend=0 (Oberon's,
// see cameraFollow.ts's FRAMING_RADIUS_MULTIPLIER) so this floor never becomes the bottleneck for
// a real body's own close-up view.
export const COMPACT_MIN_ORBIT_RADIUS = 5
export const REALISTIC_MIN_ORBIT_RADIUS = 0.0005

// The camera's zoom-in limit, blended the same way as body radii/moon orbits (see geometricBlend
// in sceneScale.ts) so it shrinks proportionally as the scale toggle moves toward Realistic,
// instead of staying fixed at a Compact-appropriate distance no matter how small the scene gets.
export function minOrbitRadiusForBlend(blend: number): number {
  return geometricBlend(REALISTIC_MIN_ORBIT_RADIUS, COMPACT_MIN_ORBIT_RADIUS, blend)
}

const REFERENCE_DEGENERACY_THRESHOLD = 0.999

function dot3(a: readonly [number, number, number], b: readonly [number, number, number]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function cross3(a: readonly [number, number, number], b: readonly [number, number, number]): [number, number, number] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

function normalize3(v: readonly [number, number, number]): [number, number, number] {
  const length = Math.hypot(v[0], v[1], v[2])
  return [v[0] / length, v[1] / length, v[2] / length]
}

export interface OrbitBasis {
  right: [number, number, number]
  forward0: [number, number, number]
}

// Builds an orthonormal (right, forward0) frame perpendicular to the given up-axis, so
// OrbitCamera can orbit around any axis (not just world Y) and defaultFramingAzimuth
// (cameraFollow.ts) can compute an azimuth relative to whatever's currently "up". forward0 is the
// azimuth=0 eye-offset direction; right is the azimuth=PI/2 direction (see getEyePosition below).
// World X is the primary Gram-Schmidt reference; world Y is the fallback for the rare case where
// upAxis is itself close to X (none of this app's 9 real body poles are - the largest X-component
// among them is Mars at 0.446 - but Uranus's real pole, [-0.212, -0.968, 0.134], sits close to
// world Y, which is exactly why Y isn't used as the PRIMARY reference: doing so would make the
// most steeply-tilted body in this app's data degenerate). See
// docs/superpowers/specs/2026-07-20-camera-north-up-orientation-design.md #3.1.
export function orbitBasisForUpAxis(upAxis: readonly [number, number, number]): OrbitBasis {
  const primaryReference: [number, number, number] = [1, 0, 0]
  const fallbackReference: [number, number, number] = [0, 1, 0]
  const reference =
    Math.abs(dot3(upAxis, primaryReference)) > REFERENCE_DEGENERACY_THRESHOLD ? fallbackReference : primaryReference
  const referenceDotUp = dot3(reference, upAxis)
  const forward0 = normalize3([
    reference[0] - referenceDotUp * upAxis[0],
    reference[1] - referenceDotUp * upAxis[1],
    reference[2] - referenceDotUp * upAxis[2],
  ])
  const right = normalize3(cross3(upAxis, forward0))
  return { right, forward0 }
}

export interface OrbitCameraOptions {
  target?: [number, number, number]
  radius?: number
  azimuth?: number
  elevation?: number
  minRadius?: number
  maxRadius?: number
  upAxis?: [number, number, number]
}

const MAX_ELEVATION = Math.PI / 2 - 0.01

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

// Orbits around `target` at a fixed distance (`radius`), parameterized by azimuth (rotation
// around `upAxis`) and elevation (angle above the plane perpendicular to `upAxis`). `upAxis`
// defaults to ECLIPTIC_NORTH, the scene's real "north" (see poleOrientation.ts) - not world Y,
// which doesn't correspond to anything astronomical. CameraFollowController re-points upAxis at a
// followed entity's own real pole direction during fly-to (see cameraFollow.ts). See
// docs/superpowers/specs/2026-07-20-camera-north-up-orientation-design.md for why this matters.
export class OrbitCamera {
  target: vec3
  radius: number
  azimuth: number
  elevation: number
  minRadius: number
  maxRadius: number
  upAxis: vec3

  constructor(options: OrbitCameraOptions = {}) {
    this.target = vec3.fromValues(...(options.target ?? [0, 0, 0]))
    this.radius = options.radius ?? 65
    this.azimuth = options.azimuth ?? 0
    this.elevation = options.elevation ?? 0.4
    this.minRadius = options.minRadius ?? 5
    this.maxRadius = options.maxRadius ?? 700
    this.upAxis = vec3.fromValues(...(options.upAxis ?? ECLIPTIC_NORTH))
  }

  getEyePosition(): vec3 {
    const cosEl = Math.cos(this.elevation)
    const sinEl = Math.sin(this.elevation)
    const sinAz = Math.sin(this.azimuth)
    const cosAz = Math.cos(this.azimuth)
    const upAxis: [number, number, number] = [this.upAxis[0], this.upAxis[1], this.upAxis[2]]
    const { right, forward0 } = orbitBasisForUpAxis(upAxis)
    const x = this.target[0] + this.radius * (cosEl * (sinAz * right[0] + cosAz * forward0[0]) + sinEl * upAxis[0])
    const y = this.target[1] + this.radius * (cosEl * (sinAz * right[1] + cosAz * forward0[1]) + sinEl * upAxis[1])
    const z = this.target[2] + this.radius * (cosEl * (sinAz * right[2] + cosAz * forward0[2]) + sinEl * upAxis[2])
    return vec3.fromValues(x, y, z)
  }

  getViewMatrix(): mat4 {
    return mat4.lookAt(mat4.create(), this.getEyePosition(), this.target, this.upAxis)
  }

  applyDrag(deltaX: number, deltaY: number, sensitivity = 0.005): void {
    this.azimuth -= deltaX * sensitivity
    this.elevation = clamp(this.elevation + deltaY * sensitivity, -MAX_ELEVATION, MAX_ELEVATION)
  }

  applyZoom(deltaY: number, sensitivity = 0.001): void {
    this.radius = clamp(this.radius * (1 + deltaY * sensitivity), this.minRadius, this.maxRadius)
  }
}
