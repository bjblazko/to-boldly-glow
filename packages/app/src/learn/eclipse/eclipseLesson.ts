import { projectToCss, type Viewpoint } from '../../camera/viewpoint'
import { placeLabel } from '../../labels/screenLabel'
import { sunVisibleFraction } from '../../lensFlare/sunVisibility'
import type { SceneLayout } from '../../scene/sceneLayout'
import type { Ephemeris } from '../../time/ephemeris'
import type { GroundShot } from '../ground/groundShot'
import type { GroundSky } from '../ground/groundSky'
import { isEclipseKind, type Chapter, type EclipseChapterKind } from '../lessonTypes'
import type { StagedLessonScene, StagedOverlayFrame } from '../stagedLessonScene'
import type { EclipseLabels } from './eclipseLabels'
import { EclipseScene } from './eclipseScene'
import { diamondGlint, eclipseSkyLight } from './eclipseSkyLight'
import { ShadowOverlay } from './shadowOverlay'
import { besideTheSun, ECLIPSE_SKY_SHOT, TOWARD_SUN_ON_HORIZON, ZENITH } from './skyGeometry'

// The solar eclipse lesson's scene with everything drawn over it: the construction lines and
// labels seen from space, the sky, horizon and eclipse glasses seen from the ground.
export class EclipseLesson implements StagedLessonScene {
  private readonly scene = new EclipseScene()
  private readonly overlay: ShadowOverlay

  constructor(
    gpu: { device: GPUDevice; linePipeline: GPURenderPipeline },
    private readonly sky: GroundSky,
    private readonly labels: EclipseLabels,
  ) {
    this.overlay = new ShadowOverlay(gpu.device, gpu.linePipeline)
  }

  handles(kind: Chapter['kind']): boolean {
    return isEclipseKind(kind)
  }

  start(chapter: Chapter): void {
    if (chapter.eclipse) this.scene.start(chapter.eclipse)
  }

  showChapter(chapter: Chapter, kindChanged: boolean): void {
    if (chapter.eclipse) this.scene.showStage(chapter.eclipse, kindChanged)
  }

  update(deltaSeconds: number, chapter: Chapter): void {
    this.scene.update(deltaSeconds, kindOf(chapter))
  }

  layout(chapter: Chapter, ephemeris: Ephemeris): SceneLayout {
    return this.scene.layout(kindOf(chapter), ephemeris)
  }

  groundShot(chapter: Chapter): GroundShot | null {
    return chapter.kind === 'eclipseSky' ? ECLIPSE_SKY_SHOT : null
  }

  updateOverlays(layout: SceneLayout, chapter: Chapter, frame: StagedOverlayFrame): void {
    const kind = kindOf(chapter)
    const { stage } = this.scene
    if (kind !== 'eclipseSky') {
      this.overlay.update(layout, kind, { ...frame, labels: this.labels, nodeDegrees: stage.nodeDegrees })
      return
    }
    this.labels.hideAll()
    const visible = sunVisibleFraction(layout, frame.viewpoint)
    const light = eclipseSkyLight(visible)
    const glint = diamondGlint(layout, frame.viewpoint, visible)
    this.sky.update(frame.viewpoint, layout.sun.radius, { light, zenith: ZENITH, north: TOWARD_SUN_ON_HORIZON, glasses: stage.glasses, sunBrightness: frame.sunBrightness, glint })
    this.placeSkyLabels(frame.viewpoint, light.glow, stage.glasses)
  }

  hideOverlays(): void {
    this.labels.hideAll()
  }

  drawBehindBodies(pass: GPURenderPassEncoder, chapter: Chapter): void {
    if (chapter.kind === 'eclipseSky') this.sky.drawBehindBodies(pass)
  }

  drawInFrontOfBodies(pass: GPURenderPassEncoder, chapter: Chapter): void {
    if (chapter.kind === 'eclipseSky') this.sky.drawInFrontOfBodies(pass)
  }

  drawOverlays(pass: GPURenderPassEncoder, chapter: Chapter): void {
    if (chapter.kind !== 'eclipseSky') this.overlay.draw(pass)
  }

  // Under the Sun while looking through the glasses; beside it once the corona shows.
  private placeSkyLabels(viewpoint: Viewpoint, glow: number, glasses: number): void {
    const place = (label: HTMLElement, point: ArrayLike<number>) => placeLabel(label, projectToCss(viewpoint, point))
    if (glasses > 0.5) place(this.labels.glasses, besideTheSun(-1.6, 0))
    if (glow > 0.8 && glasses < 0.5) place(this.labels.corona, besideTheSun(1.8, 2.6))
  }
}

function kindOf(chapter: Chapter): EclipseChapterKind {
  if (!isEclipseKind(chapter.kind)) throw new Error(`Not an eclipse chapter: ${chapter.id}`)
  return chapter.kind
}
