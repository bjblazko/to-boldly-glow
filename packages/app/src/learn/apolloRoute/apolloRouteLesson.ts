import type { SceneLayout } from '../../scene/sceneLayout'
import type { Ephemeris } from '../../time/ephemeris'
import type { GroundShot } from '../ground/groundShot'
import type { LessonShot } from '../lessonShot'
import type { Chapter } from '../lessonTypes'
import type { StagedLessonScene, StagedOverlayFrame } from '../stagedLessonScene'
import type { VoyagerLabels } from '../voyager/voyagerLabels'
import { ApolloRouteScene } from './apolloRouteScene'
import { ApolloRouteOverlay, placeApolloRouteLabels } from './routeOverlay'
import { apolloRouteShot } from './routeShots'

function prefersReducedMotion(): boolean {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

// The Apollo 11 lesson: the mission from launch to splashdown on a drawn route between a staged
// Earth and Moon (see routeGeometry.ts) - the craft moving along it chapter by chapter.
export class ApolloRouteLesson implements StagedLessonScene {
  private readonly scene = new ApolloRouteScene()
  private readonly overlay: ApolloRouteOverlay

  constructor(
    gpu: { device: GPUDevice; linePipeline: GPURenderPipeline },
    private readonly labels: VoyagerLabels,
  ) {
    this.overlay = new ApolloRouteOverlay(gpu.device, gpu.linePipeline)
  }

  handles(kind: Chapter['kind']): boolean {
    return kind === 'apolloRoute'
  }

  // Opening the lesson (or jumping to a chapter from elsewhere) shows the chapter's end at once.
  start(chapter: Chapter): void {
    if (chapter.apolloRoute) this.scene.show(chapter.apolloRoute, false)
  }

  showChapter(chapter: Chapter): void {
    if (chapter.apolloRoute) this.scene.show(chapter.apolloRoute, !prefersReducedMotion())
  }

  update(deltaSeconds: number): void {
    this.scene.update(deltaSeconds)
  }

  layout(_chapter: Chapter, ephemeris: Ephemeris): SceneLayout {
    return this.scene.layout(ephemeris)
  }

  groundShot(): GroundShot | null {
    return null
  }

  shot(chapter: Chapter): LessonShot {
    return apolloRouteShot(chapter.apolloRoute ?? { view: 'whole', from: 0, to: 0, event: 'liftoff' })
  }

  updateOverlays(_layout: SceneLayout, _chapter: Chapter, frame: StagedOverlayFrame): void {
    this.overlay.update(this.scene, frame)
    placeApolloRouteLabels(this.labels, this.scene, frame.viewpoint)
  }

  hideOverlays(): void {
    this.labels.hideAll()
  }

  drawBehindBodies(): void {}

  drawInFrontOfBodies(): void {}

  drawOverlays(pass: GPURenderPassEncoder): void {
    this.overlay.draw(pass)
  }
}
