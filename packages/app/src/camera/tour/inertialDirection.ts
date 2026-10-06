import { mat4, vec3 } from 'gl-matrix'
import { angleBetween } from './shipMotion'

export interface TurnLimits {
  // Radians per second.
  maxRate: number
  // Radians per second squared: how quickly a turn can start, stop or swing to another axis.
  acceleration: number
  // Optional: aim for at most this many times the remaining angle per second, so the direction
  // settles onto a target (and follows a moving one) without hunting around it.
  settleRate?: number
}

// A direction that turns like a heavy body: its angular velocity builds up, dies down and changes
// axis only within an angular acceleration limit, so every turn eases in and out, and it brakes in
// time to come to rest on its target instead of overshooting it.
export class InertialDirection {
  readonly direction: vec3
  readonly angularVelocity = vec3.create()

  constructor(
    direction: vec3,
    private readonly limits: TurnLimits,
    // The axis to turn around when the target is exactly behind (where any axis would do).
    private readonly fallbackAxis: vec3,
  ) {
    this.direction = vec3.clone(direction)
  }

  // Points the direction somewhere new, at rest.
  reset(direction: vec3): void {
    vec3.copy(this.direction, direction)
    vec3.zero(this.angularVelocity)
  }

  // Takes a direction set from outside (along a scripted path) together with the angular velocity
  // that moved it there, so turning on from it later continues the motion without a jolt.
  follow(direction: vec3, deltaSeconds: number): void {
    const axis = vec3.cross(vec3.create(), this.direction, direction)
    const rate = deltaSeconds > 0 ? angleBetween(this.direction, direction) / deltaSeconds : 0
    if (vec3.length(axis) > 1e-12) vec3.scale(this.angularVelocity, vec3.normalize(axis, axis), rate)
    else vec3.zero(this.angularVelocity)
    vec3.copy(this.direction, direction)
  }

  turnToward(target: vec3, deltaSeconds: number, maxRate = this.limits.maxRate): void {
    const change = vec3.subtract(vec3.create(), this.desiredAngularVelocity(target, maxRate), this.angularVelocity)
    const maxChange = this.limits.acceleration * deltaSeconds
    if (vec3.length(change) > maxChange) vec3.scale(change, change, maxChange / vec3.length(change))
    vec3.add(this.angularVelocity, this.angularVelocity, change)
    this.rotate(deltaSeconds)
  }

  private desiredAngularVelocity(target: vec3, maxRate: number): vec3 {
    const remaining = angleBetween(this.direction, target)
    if (remaining < 1e-9) return vec3.create()
    let axis = vec3.cross(vec3.create(), this.direction, target)
    if (vec3.length(axis) < 1e-9) axis = vec3.clone(this.fallbackAxis)
    const { acceleration, settleRate = Infinity } = this.limits
    const rate = Math.min(maxRate, Math.sqrt(2 * acceleration * remaining), settleRate * remaining)
    return vec3.scale(axis, vec3.normalize(axis, axis), rate)
  }

  private rotate(deltaSeconds: number): void {
    // A spin around the direction itself would not move it; drop it so it can't build up unseen.
    vec3.scaleAndAdd(this.angularVelocity, this.angularVelocity, this.direction, -vec3.dot(this.angularVelocity, this.direction))
    const rate = vec3.length(this.angularVelocity)
    if (rate < 1e-12) return
    const axis = vec3.scale(vec3.create(), this.angularVelocity, 1 / rate)
    const rotation = mat4.fromRotation(mat4.create(), rate * deltaSeconds, axis)
    vec3.normalize(this.direction, vec3.transformMat4(this.direction, this.direction, rotation))
  }
}
