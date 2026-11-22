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
import type { KeepOut } from '../lessonCameraViews'
import type { Vec3 } from '../../math/tuples'
import { CLOSEUPS } from './closeupChoreography'
import { closeupFrame, framePoint } from './closeupFrames'
import { ROUTE_EARTH, ROUTE_EARTH_RADIUS, ROUTE_MOON, ROUTE_MOON_RADIUS } from './routeGeometry'
import { CloseupActors } from './closeupActors'
import type { ModelContext } from '../../spacecraft/modelRenderer'

const ROUTE_KEEP_OUT: readonly KeepOut[] = [
  { center: ROUTE_MOON, radius: ROUTE_MOON_RADIUS * 1.005 },
  { center: ROUTE_EARTH, radius: ROUTE_EARTH_RADIUS * 1.01 },
]

function prefersReducedMotion(): boolean {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

// The Apollo 11 lesson: the mission from launch to splashdown on a drawn route between a staged
// Earth and Moon (see routeGeometry.ts) - the craft moving along it chapter by chapter, and the
// moments it can only name played close up with the vehicles themselves (closeupChoreography.ts).
export class ApolloRouteLesson implements StagedLessonScene {
  private readonly scene = new ApolloRouteScene()
  private readonly overlay: ApolloRouteOverlay

  private readonly actors: CloseupActors

  constructor(
    gpu: { device: GPUDevice; linePipeline: GPURenderPipeline; models: ModelContext },
    private readonly labels: VoyagerLabels,
  ) {
    this.overlay = new ApolloRouteOverlay(gpu.device, gpu.linePipeline)
    this.actors = new CloseupActors(gpu.models)
  }

  handles(kind: Chapter['kind']): boolean {
    return kind === 'apolloRoute'
  }

  // Opening the lesson (or jumping to a chapter from elsewhere) shows the chapter's end at once.
  start(chapter: Chapter): void {
    this.actors.load()
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

  // Over Earth and the Moon, not through them, the camera's flights (just above the Moon's ground,
  // which its close-ups stand on).
  keepOut(): readonly KeepOut[] {
    return ROUTE_KEEP_OUT
  }

  // The camera, standing on the ground, turns up after the ascent stage as it lifts off.
  follow(): Vec3 | null {
    const closeup = this.scene.stage?.closeup
    const follow = closeup ? CLOSEUPS[closeup].follow : undefined
    return closeup && follow ? framePoint(closeupFrame(closeup), follow(Math.min(this.scene.closeupPlayed, CLOSEUPS[closeup].seconds))) : null
  }

  groundShot(): GroundShot | null {
    return null
  }

  shot(chapter: Chapter): LessonShot {
    return apolloRouteShot(chapter.apolloRoute ?? { view: 'whole', from: 0, to: 0, event: 'liftoff' })
  }

  updateOverlays(_layout: SceneLayout, _chapter: Chapter, frame: StagedOverlayFrame): void {
    const closeup = this.scene.stage?.closeup
    if (!closeup) {
      this.overlay.update(this.scene, frame)
      placeApolloRouteLabels(this.labels, this.scene, frame.viewpoint)
      return
    }
    const seconds = this.scene.closeupPlayed
    this.actors.prepare(frame.viewpoint, closeup, seconds)
    placeApolloRouteLabels(this.labels, this.scene, frame.viewpoint, this.actors.labels(closeup, seconds))
  }

  hideOverlays(): void {
    this.labels.hideAll()
  }

  drawBehindBodies(): void {}

  drawInFrontOfBodies(pass: GPURenderPassEncoder): void {
    if (this.scene.stage?.closeup) this.actors.draw(pass)
  }

  drawOverlays(pass: GPURenderPassEncoder): void {
    if (!this.scene.stage?.closeup) this.overlay.draw(pass)
  }
}
