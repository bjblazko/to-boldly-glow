import { mat4, vec3 } from 'gl-matrix'

export interface FlyCameraOptions {
  position?: [number, number, number]
  yaw?: number
  pitch?: number
}

const MAX_PITCH = Math.PI / 2 - 0.01

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

// First-person free-fly camera: `position` in world space, `yaw` (rotation around Y) and `pitch`
// (rotation around the local right axis, clamped to avoid flipping past straight up/down).
// Default yaw of PI faces -Z, matching the renderer-core plan's fixed camera (which looked from
// +Z toward the origin).
export class FlyCamera {
  position: vec3
  yaw: number
  pitch: number

  constructor(options: FlyCameraOptions = {}) {
    this.position = vec3.fromValues(...(options.position ?? [0, 25, 60]))
    this.yaw = options.yaw ?? Math.PI
    this.pitch = options.pitch ?? 0
  }

  getForward(): vec3 {
    const cosPitch = Math.cos(this.pitch)
    return vec3.fromValues(
      cosPitch * Math.sin(this.yaw),
      Math.sin(this.pitch),
      cosPitch * Math.cos(this.yaw),
    )
  }

  getRight(): vec3 {
    const forward = this.getForward()
    const right = vec3.cross(vec3.create(), forward, [0, 1, 0])
    return vec3.normalize(right, right)
  }

  getViewMatrix(): mat4 {
    const forward = this.getForward()
    const target = vec3.add(vec3.create(), this.position, forward)
    return mat4.lookAt(mat4.create(), this.position, target, [0, 1, 0])
  }

  applyLook(deltaX: number, deltaY: number, sensitivity = 0.003): void {
    this.yaw -= deltaX * sensitivity
    this.pitch = clamp(this.pitch - deltaY * sensitivity, -MAX_PITCH, MAX_PITCH)
  }

  moveForward(distance: number): void {
    const forward = this.getForward()
    vec3.scaleAndAdd(this.position, this.position, forward, distance)
  }

  moveRight(distance: number): void {
    const right = this.getRight()
    vec3.scaleAndAdd(this.position, this.position, right, distance)
  }
}
