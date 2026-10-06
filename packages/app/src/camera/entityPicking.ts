import type { Vec3 } from '../math/tuples'
import { projectToCss, type Viewpoint } from './viewpoint'

// Something on screen that can be clicked to fly there.
export interface PickTarget {
  id: string
  position: Vec3
  radius: number
}

// How far from a body's disk (CSS pixels) a click still counts as on it: small bodies are dots.
const PICK_TOLERANCE_PX = 18

// The target under a point on the canvas (CSS pixels from its top-left), or null: the one whose
// disk the point is in, or nearest to it within the tolerance - the closest to the camera when
// several overlap, so a moon in front of its planet wins.
export function pickTarget(point: { x: number; y: number }, targets: readonly PickTarget[], viewpoint: Viewpoint): string | null {
  let best: { id: string; depth: number } | null = null
  for (const target of targets) {
    const screen = projectToCss(viewpoint, target.position)
    if (!screen.visible) continue
    const depth = Math.hypot(target.position[0] - viewpoint.position[0], target.position[1] - viewpoint.position[1], target.position[2] - viewpoint.position[2])
    const radiusPx = (target.radius / Math.max(depth, 1e-9)) * ((viewpoint.projection[5] * viewpoint.cssPixels.height) / 2)
    const miss = Math.hypot(screen.x - point.x, screen.y - point.y) - radiusPx
    if (miss <= PICK_TOLERANCE_PX && (!best || depth < best.depth)) best = { id: target.id, depth }
  }
  return best?.id ?? null
}
