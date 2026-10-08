import { projectToCss, type Viewpoint } from '../../camera/viewpoint'
import { placeLabel } from '../../labels/screenLabel'
import type { SceneLayout } from '../../scene/sceneLayout'
import type { Ephemeris } from '../../time/ephemeris'
import type { Chapter, EclipseChapterKind } from '../lessonTypes'
import type { EclipseLabels } from './eclipseLabels'
import { EclipseScene } from './eclipseScene'
import type { GroundSky } from './groundSky'
import { ShadowOverlay } from './shadowOverlay'
import { besideTheSun } from './skyGeometry'

export interface EclipseFrame {
  viewpoint: Viewpoint
  nowSeconds: number
  // The Sun's own brightness this frame (see bodies/sunSurface.ts), which the eclipse glasses dim.
  sunBrightness: number
}

// The solar eclipse lesson's scene with everything drawn over it: the construction lines and
// labels seen from space, the sky, horizon and eclipse glasses seen from the ground.
export class EclipseLesson {
  private readonly scene = new EclipseScene()
  private readonly overlay: ShadowOverlay

  constructor(
    gpu: { device: GPUDevice; linePipeline: GPURenderPipeline },
    private readonly sky: GroundSky,
    private readonly labels: EclipseLabels,
  ) {
    this.overlay = new ShadowOverlay(gpu.device, gpu.linePipeline)
  }

  start(chapter: Chapter): void {
    if (chapter.eclipse) this.scene.start(chapter.eclipse)
  }

  showChapter(chapter: Chapter, kindChanged: boolean): void {
    if (chapter.eclipse) this.scene.showStage(chapter.eclipse, kindChanged)
  }

  update(deltaSeconds: number, kind: EclipseChapterKind): void {
    this.scene.update(deltaSeconds, kind)
  }

  layout(kind: EclipseChapterKind, ephemeris: Ephemeris): SceneLayout {
    return this.scene.layout(kind, ephemeris)
  }

  updateOverlays(layout: SceneLayout, kind: EclipseChapterKind, frame: EclipseFrame): void {
    const { stage } = this.scene
    if (kind === 'eclipseSky') {
      this.labels.hideAll()
      const light = this.sky.update(layout, frame.viewpoint, { stage, sunBrightness: frame.sunBrightness })
      this.placeSkyLabels(frame.viewpoint, light.glow, stage.glasses)
    } else {
      this.overlay.update(layout, kind, { ...frame, labels: this.labels, nodeDegrees: stage.nodeDegrees })
    }
  }

  // Under the Sun while looking through the glasses; beside it once the corona shows.
  private placeSkyLabels(viewpoint: Viewpoint, glow: number, glasses: number): void {
    const place = (label: HTMLElement, point: ArrayLike<number>) => placeLabel(label, projectToCss(viewpoint, point))
    if (glasses > 0.5) place(this.labels.glasses, besideTheSun(-1.6, 0))
    if (glow > 0.8 && glasses < 0.5) place(this.labels.corona, besideTheSun(1.8, 2.6))
  }

  hideLabels(): void {
    this.labels.hideAll()
  }

  drawBehindBodies(pass: GPURenderPassEncoder, kind: EclipseChapterKind): void {
    if (kind === 'eclipseSky') this.sky.drawBehindBodies(pass)
  }

  drawInFrontOfBodies(pass: GPURenderPassEncoder, kind: EclipseChapterKind): void {
    if (kind === 'eclipseSky') this.sky.drawInFrontOfBodies(pass)
  }

  // Expects the line pipeline to be set on the pass.
  drawOverlays(pass: GPURenderPassEncoder, kind: EclipseChapterKind): void {
    if (kind !== 'eclipseSky') this.overlay.draw(pass)
  }
}
