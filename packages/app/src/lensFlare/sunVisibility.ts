import { projectToPixels, type Viewpoint } from '../camera/viewpoint'
import type { BodyPose, SceneLayout } from '../scene/sceneLayout'
import { circleOverlapFraction } from './circleOverlap'

interface ScreenDisc {
  x: number
  y: number
  radius: number
  visible: boolean
}

// How much of the Sun's on-screen disc is not covered by a nearer planet or moon, from 1 (fully
// visible) to 0. Fades the whole flare smoothly as a body slides across the Sun, complementing the
// flare's per-pixel depth test, which only clips the flare where a body actually covers it.
export function sunVisibleFraction(layout: SceneLayout, viewpoint: Viewpoint): number {
  const sunDistance = Math.hypot(...viewpoint.position)
  const sunDisc = screenDisc(layout.sun, viewpoint)
  let visibleFraction = 1
  for (const body of [...layout.planets, ...layout.moons]) {
    if (distanceToCamera(body, viewpoint) >= sunDistance) continue
    const bodyDisc = screenDisc(body, viewpoint)
    if (!bodyDisc.visible) continue
    const separation = Math.hypot(bodyDisc.x - sunDisc.x, bodyDisc.y - sunDisc.y)
    visibleFraction = Math.min(visibleFraction, 1 - circleOverlapFraction(sunDisc.radius, bodyDisc.radius, separation))
  }
  return Math.max(0, visibleFraction)
}

function distanceToCamera(body: BodyPose, viewpoint: Viewpoint): number {
  const [x, y, z] = body.position
  return Math.hypot(x - viewpoint.position[0], y - viewpoint.position[1], z - viewpoint.position[2])
}

// The body's projected center plus its projected radius, measured along the camera's right axis.
function screenDisc(body: BodyPose, viewpoint: Viewpoint): ScreenDisc {
  const { view } = viewpoint
  const [x, y, z] = body.position
  const center = projectToPixels(viewpoint, body.position)
  const edge = projectToPixels(viewpoint, [x + view[0] * body.radius, y + view[4] * body.radius, z + view[8] * body.radius])
  return { x: center.x, y: center.y, radius: Math.hypot(edge.x - center.x, edge.y - center.y), visible: center.visible }
}
