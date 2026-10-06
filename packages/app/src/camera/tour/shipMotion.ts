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
