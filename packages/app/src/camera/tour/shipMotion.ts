import { mat4, vec3 } from 'gl-matrix'

// Fraction of the remaining gap to close within deltaSeconds, independent of the frame rate.
export function smoothingFactor(rate: number, deltaSeconds: number): number {
  return 1 - Math.exp(-rate * deltaSeconds)
}

// Moves a value toward a target by at most maxStep.
export function stepToward(value: number, target: number, maxStep: number): number {
  return value + Math.min(Math.max(target - value, -maxStep), maxStep)
}

// The angle between two unit vectors.
export function angleBetween(a: vec3, b: vec3): number {
  return Math.acos(Math.min(1, Math.max(-1, vec3.dot(a, b))))
}

// Turns a unit direction toward another by at most maxAngle radians, along the great circle
// between them. Exactly opposite directions turn around `fallbackAxis` (a level turn).
export function turnToward(direction: vec3, desired: vec3, maxAngle: number, fallbackAxis: vec3): vec3 {
  const angle = angleBetween(direction, desired)
  if (angle < 1e-9) return vec3.clone(desired)
  let axis = vec3.cross(vec3.create(), direction, desired)
  if (vec3.length(axis) < 1e-9) axis = vec3.clone(fallbackAxis)
  vec3.normalize(axis, axis)
  const rotation = mat4.fromRotation(mat4.create(), Math.min(angle, maxAngle), axis)
  return vec3.normalize(vec3.create(), vec3.transformMat4(vec3.create(), direction, rotation))
}

// The signed rate (radians per second) at which a direction turned around `axis` in one step.
export function turnRateAround(before: vec3, after: vec3, axis: vec3, deltaSeconds: number): number {
  if (deltaSeconds <= 0) return 0
  const cross = vec3.cross(vec3.create(), before, after)
  return Math.asin(Math.min(1, Math.max(-1, vec3.dot(cross, axis)))) / deltaSeconds
}

export interface Engine {
  // The most the engine can speed the ship up or slow it down, in units per second squared.
  acceleration: number
}

// How the ship's speed changes: its thrust builds up and dies down over THRUST_RESPONSE_SECONDS
// (no jolt when it starts, stops, or turns from accelerating to braking), and it eases into the
// speed it aims for instead of hitting it at full thrust - an elastic, never mechanical, motion.
export const THRUST_RESPONSE_SECONDS = 1.2
export const SPEED_SETTLE_SECONDS = 1.5
// Roughly how far behind its target speed the ship's speed runs while that target changes.
export const SPEED_LAG_SECONDS = SPEED_SETTLE_SECONDS + THRUST_RESPONSE_SECONDS / 2

export class Throttle {
  speed = 0
  thrust = 0

  stop(): void {
    this.speed = 0
    this.thrust = 0
  }

  update(targetSpeed: number, engine: Engine, deltaSeconds: number): number {
    const { acceleration } = engine
    const wanted = Math.min(Math.max((targetSpeed - this.speed) / SPEED_SETTLE_SECONDS, -acceleration), acceleration)
    this.thrust = stepToward(this.thrust, wanted, (acceleration / THRUST_RESPONSE_SECONDS) * deltaSeconds)
    this.speed = Math.max(0, this.speed + this.thrust * deltaSeconds)
    return this.speed
  }

  // Taken over from a scripted motion (the flyby loop), with no thrust left to carry over.
  coast(speed: number): void {
    this.speed = speed
    this.thrust = 0
  }
}
