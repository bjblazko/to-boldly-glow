import { mat4, vec3 } from 'gl-matrix'

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
