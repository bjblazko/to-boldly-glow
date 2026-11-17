export interface Point {
  x: number
  y: number
}

// Two fingers moving at once: how far their midpoint moved (a pan), how much their spread changed
// (a pinch: above 1 apart), and where the midpoint is now (what the pinch zooms toward).
export function twoFingerMove(before: [Point, Point], after: [Point, Point]): { pan: [number, number]; factor: number; center: Point } {
  const [from, to] = [midpoint(before), midpoint(after)]
  const spreadBefore = spread(before)
  return { pan: [to.x - from.x, to.y - from.y], factor: spreadBefore > 0 ? spread(after) / spreadBefore : 1, center: to }
}

function midpoint([a, b]: [Point, Point]): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function spread([a, b]: [Point, Point]): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}
