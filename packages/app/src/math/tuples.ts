// Plain number tuples for positions, directions and colors that are computed on the CPU and then
// packed into GPU uniforms or overlay vertex arrays.
export type Vec3 = [number, number, number]
export type Rgb = [number, number, number]
export type Rgba = [number, number, number, number]

// point + direction * distance
export function pointAlong(point: ArrayLike<number>, direction: ArrayLike<number>, distance: number): Vec3 {
  return [point[0] + direction[0] * distance, point[1] + direction[1] * distance, point[2] + direction[2] * distance]
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

// 0 below edge0, 1 above edge1, and a smooth (Hermite) step in between.
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}
