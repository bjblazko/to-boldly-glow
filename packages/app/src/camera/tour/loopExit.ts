import type { vec3 } from 'gl-matrix'

// Leaving a planet, the ship circles on until it heads within EXIT_ALIGNMENT of the next one (for at
// most one more lap), so it slips out of its loop along the circle instead of turning around - as
// seen from above, since the next stop may lie well above or below the loop's plane (Mercury, from
// the Sun's). A next stop inside the loop no point of the circle heads for: then it leaves at once.
const EXIT_ALIGNMENT = Math.cos((25 * Math.PI) / 180)

export function mayLeaveLoop(loop: { angle: number; startOffset: vec3 }, { heading, position, center, next }: { heading: vec3; position: vec3; center: vec3; next: vec3 }): boolean {
  const toNext: [number, number] = [next[0] - position[0], next[1] - position[1]]
  const insideLoop = Math.hypot(next[0] - center[0], next[1] - center[1]) < Math.hypot(loop.startOffset[0], loop.startOffset[1])
  return levelAlignment(heading, toNext) >= EXIT_ALIGNMENT || loop.angle >= 4 * Math.PI || insideLoop
}

// How well a direction heads along another, seen from above (both flattened onto the ecliptic).
function levelAlignment(direction: vec3, toPoint: readonly [number, number]): number {
  const a = Math.hypot(direction[0], direction[1])
  const b = Math.hypot(toPoint[0], toPoint[1])
  return a > 1e-9 && b > 1e-9 ? (direction[0] * toPoint[0] + direction[1] * toPoint[1]) / (a * b) : 1
}
