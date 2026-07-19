export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

// Interpolates between two angles (radians) the short way around the circle, rather than a plain
// lerp which can sweep the long way when a and b straddle a 2*PI wraparound.
export function lerpAngle(a: number, b: number, t: number): number {
  const twoPi = 2 * Math.PI
  const diff = (((b - a) % twoPi) + twoPi + Math.PI) % twoPi
  return a + (diff - Math.PI) * t
}

export function lerpVec3(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  t: number,
): [number, number, number] {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
}
