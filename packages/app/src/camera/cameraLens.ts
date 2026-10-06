import type { mat4 } from 'gl-matrix'
import { minOrbitRadiusForBlend, type OrbitCamera } from './orbitCamera'
import { perspectiveProjection } from './viewpoint'

// The orbit camera's zoom floor and the projection derived from it (the near plane scales with the
// floor). Outside lessons the floor follows the Realistic/Compact blend, so a body's close-up stays
// reachable at any scale; lessons stage fixed scenes at their own scale and set their own floor.
export class CameraLens {
  lensShiftNdc = 0
  private lessonZoomFloor: number | null = null
  private scaleBlend = 1

  constructor(
    private readonly orbit: OrbitCamera,
    private readonly canvas: HTMLCanvasElement,
  ) {}

  setLessonZoomFloor(minRadius: number | null): void {
    this.lessonZoomFloor = minRadius
    this.applyZoomFloor(this.scaleBlend)
  }

  applyZoomFloor(scaleBlend: number): void {
    this.scaleBlend = scaleBlend
    this.orbit.minRadius = this.lessonZoomFloor ?? minOrbitRadiusForBlend(scaleBlend)
  }

  projection(): mat4 {
    return perspectiveProjection(this.canvas.width / this.canvas.height, this.orbit.minRadius, this.lensShiftNdc)
  }
}
