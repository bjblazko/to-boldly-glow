import type { Vec3 } from '../math/tuples'
import type { FilmLook } from '../bloom/filmLook'
import type { Viewpoint } from '../camera/viewpoint'
import type { SceneLayout } from '../scene/sceneLayout'
import type { Ephemeris } from '../time/ephemeris'
import type { GroundShot } from './ground/groundShot'
import type { LessonShot } from './lessonShot'
import type { KeepOut } from './lessonCameraViews'
import type { Chapter } from './lessonTypes'

export interface StagedOverlayFrame {
  viewpoint: Viewpoint
  nowSeconds: number
  // The Sun's own brightness this frame (see bodies/sunSurface.ts).
  sunBrightness: number
}

// A lesson that stages its own scene (the solar eclipse, the Moon's phases, Voyager): what
// LessonSession asks of it, for the chapters it handles.
export interface StagedLessonScene {
  handles(kind: Chapter['kind']): boolean
  start(chapter: Chapter): void
  // Within the same kind of shot the scene eases to the new chapter; a new kind starts from it.
  showChapter(chapter: Chapter, kindChanged: boolean): void
  // `viewLeft`: the user has moved the camera away from the chapter's shot (see LessonCamera), so a
  // turntable holds still until the shot is framed again.
  update(deltaSeconds: number, chapter: Chapter, viewLeft: boolean): void
  layout(chapter: Chapter, ephemeris: Ephemeris): SceneLayout
  // The view from the ground, for the chapters that show it (it may move as the scene does).
  groundShot(chapter: Chapter): GroundShot | null
  // The chapter's own camera shot, for scenes that frame each chapter differently.
  shot?(chapter: Chapter): LessonShot
  // Where the camera moves once the lesson has been read out to its end, if anywhere.
  closingShot?(chapter: Chapter): LessonShot | null
  updateOverlays(layout: SceneLayout, chapter: Chapter, frame: StagedOverlayFrame): void
  hideOverlays(): void
  // Passes before the scene's own (a lamp's shadow map), for scenes that need them.
  encodeBeforeScene?(encoder: GPUCommandEncoder, chapter: Chapter): void
  // What a double click on the scene points at (normalized device coordinates), for scenes that
  // let the user look at a spot (a cabin): the point it hits, or null.
  pick?(ndc: [number, number], chapter: Chapter): Vec3 | null
  // How far along a ray (unit direction) the scene stands in the way, within `within` if given:
  // what stops the camera walking through a cabin's walls.
  obstacle?(origin: Vec3, direction: Vec3, within: number | undefined, chapter: Chapter): number | null
  // Balls the camera's flights between shots pass over rather than through (its planets).
  keepOut?(chapter: Chapter): readonly KeepOut[]
  // A point the camera keeps looking at while the chapter plays (a craft lifting off), if any.
  follow?(chapter: Chapter): Vec3 | null
  // A film look over the finished picture, for scenes that want one.
  filmLook?(chapter: Chapter): FilmLook | null
  drawBehindBodies(pass: GPURenderPassEncoder, chapter: Chapter): void
  drawInFrontOfBodies(pass: GPURenderPassEncoder, chapter: Chapter): void
  // Expects the line pipeline to be set on the pass.
  drawOverlays(pass: GPURenderPassEncoder, chapter: Chapter): void
}
