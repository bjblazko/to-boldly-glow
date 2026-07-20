import { mat4, vec3 } from 'gl-matrix'
import { geometricBlend } from '../solarSystem/sceneScale'

// The Explorer-mode zoom-in floor (matches OrbitCamera's own default minRadius) was tuned for
// Explorer-scale body sizes (~0.1-3 scene units). At Realistic scale (blend=0), body/moon radii
// and moon-orbit distances shrink into the ~0.0001-0.09 unit range (see sceneScale.ts/
// moonOrbit.ts's geometricBlend endpoints), so a fixed 5-unit floor makes it impossible to zoom
// close enough to tell any two nearby bodies apart - e.g. the Moon's entire real orbit around
// Earth (~0.05 units) is roughly 100x smaller than this floor, so the camera can never get closer
// to Earth than 100x the Earth-Moon distance itself. REALISTIC_MIN_ORBIT_RADIUS is chosen below
// the smallest default fly-to framing distance among all rendered bodies at blend=0 (Oberon's,
// see cameraFollow.ts's FRAMING_RADIUS_MULTIPLIER) so this floor never becomes the bottleneck for
// a real body's own close-up view.
export const EXPLORER_MIN_ORBIT_RADIUS = 5
export const REALISTIC_MIN_ORBIT_RADIUS = 0.0005

// The camera's zoom-in limit, blended the same way as body radii/moon orbits (see geometricBlend
// in sceneScale.ts) so it shrinks proportionally as the scale slider moves toward Realistic,
// instead of staying fixed at an Explorer-appropriate distance no matter how small the scene gets.
export function minOrbitRadiusForBlend(blend: number): number {
  return geometricBlend(REALISTIC_MIN_ORBIT_RADIUS, EXPLORER_MIN_ORBIT_RADIUS, blend)
}

export interface OrbitCameraOptions {
  target?: [number, number, number]
  radius?: number
  azimuth?: number
  elevation?: number
  minRadius?: number
  maxRadius?: number
}

const MAX_ELEVATION = Math.PI / 2 - 0.01

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

// Orbits around `target` at a fixed distance (`radius`), parameterized by azimuth (rotation
// around the Y axis) and elevation (angle above the horizontal plane). Default values roughly
// match the renderer-core plan's fixed camera framing (eye ~[0, 25, 60]).
export class OrbitCamera {
  target: vec3
  radius: number
  azimuth: number
  elevation: number
  minRadius: number
  maxRadius: number

  constructor(options: OrbitCameraOptions = {}) {
    this.target = vec3.fromValues(...(options.target ?? [0, 0, 0]))
    this.radius = options.radius ?? 65
    this.azimuth = options.azimuth ?? 0
    this.elevation = options.elevation ?? 0.4
    this.minRadius = options.minRadius ?? 5
    this.maxRadius = options.maxRadius ?? 700
  }

  getEyePosition(): vec3 {
    const cosEl = Math.cos(this.elevation)
    const x = this.target[0] + this.radius * cosEl * Math.sin(this.azimuth)
    const y = this.target[1] + this.radius * Math.sin(this.elevation)
    const z = this.target[2] + this.radius * cosEl * Math.cos(this.azimuth)
    return vec3.fromValues(x, y, z)
  }

  getViewMatrix(): mat4 {
    return mat4.lookAt(mat4.create(), this.getEyePosition(), this.target, [0, 1, 0])
  }

  applyDrag(deltaX: number, deltaY: number, sensitivity = 0.005): void {
    this.azimuth -= deltaX * sensitivity
    this.elevation = clamp(this.elevation + deltaY * sensitivity, -MAX_ELEVATION, MAX_ELEVATION)
  }

  applyZoom(deltaY: number, sensitivity = 0.001): void {
    this.radius = clamp(this.radius * (1 + deltaY * sensitivity), this.minRadius, this.maxRadius)
  }
}
