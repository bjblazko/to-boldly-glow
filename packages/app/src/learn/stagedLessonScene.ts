import type { Viewpoint } from '../camera/viewpoint'
import type { SceneLayout } from '../scene/sceneLayout'
import type { Ephemeris } from '../time/ephemeris'
import type { GroundShot } from './ground/groundShot'
import type { Chapter } from './lessonTypes'

export interface StagedOverlayFrame {
  viewpoint: Viewpoint
  nowSeconds: number
  // The Sun's own brightness this frame (see bodies/sunSurface.ts).
  sunBrightness: number
}

// A lesson that stages its own Sun, Earth and Moon (the solar eclipse and Moon phases lessons): what
// LessonSession asks of it, for the chapters it handles.
export interface StagedLessonScene {
  handles(kind: Chapter['kind']): boolean
  start(chapter: Chapter): void
  // Within the same kind of shot the scene eases to the new chapter; a new kind starts from it.
  showChapter(chapter: Chapter, kindChanged: boolean): void
  update(deltaSeconds: number, chapter: Chapter): void
  layout(chapter: Chapter, ephemeris: Ephemeris): SceneLayout
  // The view from the ground, for the chapters that show it (it may move as the scene does).
  groundShot(chapter: Chapter): GroundShot | null
  updateOverlays(layout: SceneLayout, chapter: Chapter, frame: StagedOverlayFrame): void
  hideOverlays(): void
  drawBehindBodies(pass: GPURenderPassEncoder, chapter: Chapter): void
  drawInFrontOfBodies(pass: GPURenderPassEncoder, chapter: Chapter): void
  // Expects the line pipeline to be set on the pass.
  drawOverlays(pass: GPURenderPassEncoder, chapter: Chapter): void
}
