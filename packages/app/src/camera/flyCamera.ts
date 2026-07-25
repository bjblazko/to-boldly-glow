import { mat3, mat4, quat, vec3 } from 'gl-matrix'

export interface FlyCameraOptions {
  position?: [number, number, number]
  yaw?: number
  pitch?: number
}

const MAX_SPEED = 60 // scene units per second

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

// First-person free-fly camera: `position` in world space, `orientation` a quaternion tracking the
// ship's facing. Orientation is stored as a quaternion (not Euler yaw/pitch) so pitch and yaw can
// both spin without limit — an Euler representation hits a gimbal-lock singularity (undefined "up")
// as pitch approaches the poles, which breaks a full vertical loop. Turning is applied as local-axis
// rotations (pitch around the ship's own right, roll around the ship's own forward), matching a
// plane's elevator/aileron controls rather than a world-anchored camera. `speed` is a signed cruise
// speed along the nose direction, set by the player and applied every frame — there's no separate
// "thrust" key.
export class FlyCamera {
  position: vec3
  orientation: quat
  speed: number

  constructor(options: FlyCameraOptions = {}) {
    this.position = vec3.fromValues(...(options.position ?? [0, 25, 60]))
    // Base forward is +Z; yaw option rotates around world Y to match the original Euler default
    // (yaw=PI faces -Z, matching the renderer-core plan's fixed camera looking from +Z toward origin).
    this.orientation = quat.setAxisAngle(quat.create(), [0, 1, 0], options.yaw ?? Math.PI)
    if (options.pitch) {
      const pitchQuat = quat.setAxisAngle(quat.create(), [1, 0, 0], options.pitch)
      quat.multiply(this.orientation, this.orientation, pitchQuat)
    }
    this.speed = 0
  }

  getForward(): vec3 {
    return vec3.transformQuat(vec3.create(), [0, 0, 1], this.orientation)
  }

  getUp(): vec3 {
    return vec3.transformQuat(vec3.create(), [0, 1, 0], this.orientation)
  }

  getRight(): vec3 {
    return vec3.transformQuat(vec3.create(), [-1, 0, 0], this.orientation)
  }

  getViewMatrix(): mat4 {
    const forward = this.getForward()
    const target = vec3.add(vec3.create(), this.position, forward)
    return mat4.lookAt(mat4.create(), this.position, target, this.getUp())
  }

  turnPitch(delta: number): void {
    const rotation = quat.setAxisAngle(quat.create(), [1, 0, 0], delta)
    quat.multiply(this.orientation, this.orientation, rotation)
  }

  turnRoll(delta: number): void {
    const rotation = quat.setAxisAngle(quat.create(), [0, 0, 1], delta)
    quat.multiply(this.orientation, this.orientation, rotation)
  }

  changeSpeed(delta: number): void {
    this.speed = clamp(this.speed + delta, -MAX_SPEED, MAX_SPEED)
  }

  moveForward(distance: number): void {
    const forward = this.getForward()
    vec3.scaleAndAdd(this.position, this.position, forward, distance)
  }

  moveRight(distance: number): void {
    const right = this.getRight()
    vec3.scaleAndAdd(this.position, this.position, right, distance)
  }

  // Snaps this camera's position/orientation to match an arbitrary eye position and look
  // direction (e.g. the orbit camera's current view), so switching into free-fly doesn't jump the
  // view to wherever the ship was last left.
  setPose(position: vec3, forward: vec3, referenceUp: vec3): void {
    vec3.copy(this.position, position)
    const f = vec3.normalize(vec3.create(), forward)
    const right = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), f, referenceUp))
    const up = vec3.cross(vec3.create(), right, f)
    // Columns map this class's base axes (right=[-1,0,0], up=[0,1,0], forward=[0,0,1]) onto the
    // given basis, matching getRight()/getUp()/getForward()'s conventions.
    const basis = mat3.fromValues(-right[0], -right[1], -right[2], up[0], up[1], up[2], f[0], f[1], f[2])
    quat.normalize(this.orientation, quat.fromMat3(quat.create(), basis))
  }
}
