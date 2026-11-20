import type { SceneLayout } from '../../scene/sceneLayout'
import type { ModelContext } from '../../spacecraft/modelRenderer'
import { ModelScene } from '../../spacecraft/modelScene'
import type { Ephemeris } from '../../time/ephemeris'
import type { GroundShot } from '../ground/groundShot'
import type { LessonShot } from '../lessonShot'
import { isVoyagerKind, type Chapter } from '../lessonTypes'
import type { StagedLessonScene, StagedOverlayFrame } from '../stagedLessonScene'
import { RecordScene } from './recordScene'
import { RouteScene } from './routeScene'
import { spacecraftLayout } from './spacecraftStage'
import { loadVoyagerAssets } from './voyagerAssets'
import type { VoyagerLabels } from './voyagerLabels'
import { placeVoyagerLabels } from './voyagerOverlay'
import { voyagerShot } from './voyagerShots'
import type { VoyagerPart } from './voyagerStage'

interface VoyagerScenes {
  probe: ModelScene<VoyagerPart>
  record: RecordScene
  route: RouteScene
}

// One turn every 90 seconds, slow enough to read the labels; it starts turned so the dish, the
// booms and the record all face the camera.
const PROBE_TURNTABLE = { secondsPerTurn: 90, startAngle: -0.5, stageSeconds: 2.2 }

function prefersReducedMotion(): boolean {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

// The Voyager lessons' scenes: the spacecraft (NASA's model), its Golden Record, and the real
// solar system along the probes' route. Their files (about 1.5 MB, all bundled with the app) load
// the first time a Voyager lesson opens; until then the chapter shows its sky alone.
export class VoyagerLesson implements StagedLessonScene {
  private scenes: VoyagerScenes | null = null
  private loading: Promise<void> | null = null
  private chapter: Chapter | null = null

  constructor(
    private readonly gpu: { device: GPUDevice; linePipeline: GPURenderPipeline; models: ModelContext },
    private readonly labels: VoyagerLabels,
  ) {}

  handles(kind: Chapter['kind']): boolean {
    return isVoyagerKind(kind)
  }

  start(chapter: Chapter): void {
    this.chapter = chapter
    this.loading ??= this.load().catch((error: unknown) => console.warn('The Voyager lessons could not load their scenes.', error))
    if (this.scenes) this.stage(chapter, true)
  }

  showChapter(chapter: Chapter, kindChanged: boolean): void {
    this.chapter = chapter
    if (this.scenes) this.stage(chapter, kindChanged)
  }

  update(deltaSeconds: number, chapter: Chapter, viewLeft: boolean): void {
    const scenes = this.scenes
    if (!scenes) return
    if (chapter.kind === 'voyagerProbe') scenes.probe.update(deltaSeconds, !viewLeft)
    else if (chapter.kind === 'voyagerRecord') scenes.record.update(deltaSeconds)
    else scenes.route.update(deltaSeconds)
  }

  layout(chapter: Chapter, ephemeris: Ephemeris): SceneLayout {
    if (chapter.kind === 'voyagerRoute' && this.scenes) return this.scenes.route.layout()
    return spacecraftLayout(ephemeris)
  }

  groundShot(): GroundShot | null {
    return null
  }

  shot(chapter: Chapter): LessonShot {
    return voyagerShot(chapter)
  }

  updateOverlays(_layout: SceneLayout, chapter: Chapter, { viewpoint }: StagedOverlayFrame): void {
    const scenes = this.scenes
    if (!scenes) return
    if (chapter.kind === 'voyagerProbe') scenes.probe.prepare(viewpoint)
    else if (chapter.kind === 'voyagerRecord') scenes.record.prepare(viewpoint)
    else scenes.route.updateLines(viewpoint)
    placeVoyagerLabels(this.labels, scenes, chapter, viewpoint)
  }

  hideOverlays(): void {
    this.labels.hideAll()
  }

  drawBehindBodies(): void {}

  drawInFrontOfBodies(pass: GPURenderPassEncoder, chapter: Chapter): void {
    if (chapter.kind === 'voyagerProbe') this.scenes?.probe.draw(pass)
    else if (chapter.kind === 'voyagerRecord') this.scenes?.record.draw(pass)
  }

  drawOverlays(pass: GPURenderPassEncoder, chapter: Chapter): void {
    if (chapter.kind === 'voyagerRoute') this.scenes?.route.drawLines(pass)
  }

  // Sets the chapter's stage; within the same kind of shot it eases there.
  private stage(chapter: Chapter, snap: boolean): void {
    const stage = chapter.voyager ?? {}
    const scenes = this.scenes!
    if (chapter.kind === 'voyagerProbe') {
      if (snap) scenes.probe.start(stage)
      else scenes.probe.show(stage, false)
    } else if (chapter.kind === 'voyagerRecord') {
      if (snap) scenes.record.start(stage)
      else scenes.record.show(stage, false)
    } else if (stage.route) scenes.route.show(stage.route, !prefersReducedMotion())
  }

  private async load(): Promise<void> {
    const assets = await loadVoyagerAssets(this.gpu.models)
    this.scenes = {
      probe: new ModelScene<VoyagerPart>(assets.probe, assets.model, PROBE_TURNTABLE),
      record: new RecordScene(assets.record),
      route: new RouteScene(this.gpu, assets.trajectories),
    }
    if (this.chapter) this.stage(this.chapter, true)
  }
}
