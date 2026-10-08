import { smoothstep } from '../../math/tuples'
import type { SceneLayout } from '../../scene/sceneLayout'
import type { Ephemeris } from '../../time/ephemeris'
import type { GroundShot } from '../ground/groundShot'
import type { GroundSky, SkyLight } from '../ground/groundSky'
import { isPhasesKind, type Chapter, type PhasesChapterKind } from '../lessonTypes'
import type { StagedLessonScene, StagedOverlayFrame } from '../stagedLessonScene'
import type { PhaseInset } from './phaseInset'
import { phaseAngle } from './phasesGeometry'
import type { PhasesLabels } from './phasesLabels'
import { PhasesOverlay } from './phasesOverlay'
import { PhasesScene } from './phasesScene'

// How the sky is lit with the Sun at this altitude (degrees): blue while it is up, fading through
// dusk (or dawn), when the sky glows over the place the Sun went down - or is about to come up.
export function twilightSkyLight(sunAltitudeDegrees: number): SkyLight {
  const daylight = smoothstep(-7, 3, sunAltitudeDegrees)
  const glow = smoothstep(-16, -4, sunAltitudeDegrees)
  return { daylight, glow, glowSpread: 0, hidesStars: smoothstep(0, 0.3, daylight) }
}

export interface PhasesUi {
  labels: PhasesLabels
  inset: PhaseInset
}

// The Moon phases lesson's scene with everything drawn over it: the construction lines, labels and
// the "seen from Earth" card in space, the sky and horizon on the ground.
export class PhasesLesson implements StagedLessonScene {
  private readonly scene = new PhasesScene()
  private readonly overlay: PhasesOverlay

  constructor(
    gpu: { device: GPUDevice; linePipeline: GPURenderPipeline },
    private readonly sky: GroundSky,
    private readonly ui: PhasesUi,
  ) {
    this.overlay = new PhasesOverlay(gpu.device, gpu.linePipeline)
  }

  handles(kind: Chapter['kind']): boolean {
    return isPhasesKind(kind)
  }

  start(chapter: Chapter): void {
    if (chapter.phases) this.scene.start(chapter.phases)
  }

  showChapter(chapter: Chapter, kindChanged: boolean): void {
    if (chapter.phases) this.scene.showStage(chapter.phases, kindChanged)
  }

  update(deltaSeconds: number): void {
    this.scene.update(deltaSeconds)
  }

  layout(chapter: Chapter, ephemeris: Ephemeris): SceneLayout {
    return this.scene.layout(kindOf(chapter), ephemeris)
  }

  groundShot(chapter: Chapter): GroundShot | null {
    return chapter.kind === 'phasesSky' ? this.scene.groundShot() : null
  }

  updateOverlays(layout: SceneLayout, chapter: Chapter, frame: StagedOverlayFrame): void {
    const kind = kindOf(chapter)
    const moon = layout.moons[0]
    this.overlay.update(layout, kind, { ...frame, labels: this.ui.labels, showNearSide: this.scene.showsNearSide })
    if (kind === 'phasesSky') {
      this.ui.inset.hide()
      const shot = this.scene.groundShot()
      const light = twilightSkyLight(this.scene.sunAltitudeDegrees)
      this.sky.update(frame.viewpoint, layout.sun.radius, { light, zenith: shot.zenith, north: shot.toward, glasses: 0, sunBrightness: frame.sunBrightness })
    } else if (moon) {
      this.ui.inset.show(phaseAngle(moon.position), this.scene.ageDegrees)
    }
  }

  hideOverlays(): void {
    this.ui.labels.hideAll()
    this.ui.inset.hide()
  }

  drawBehindBodies(pass: GPURenderPassEncoder, chapter: Chapter): void {
    if (chapter.kind === 'phasesSky') this.sky.drawBehindBodies(pass)
  }

  drawInFrontOfBodies(pass: GPURenderPassEncoder, chapter: Chapter): void {
    if (chapter.kind === 'phasesSky') this.sky.drawInFrontOfBodies(pass)
  }

  drawOverlays(pass: GPURenderPassEncoder, chapter: Chapter): void {
    if (chapter.kind !== 'phasesSky') this.overlay.draw(pass)
  }
}

function kindOf(chapter: Chapter): PhasesChapterKind {
  if (!isPhasesKind(chapter.kind)) throw new Error(`Not a Moon phases chapter: ${chapter.id}`)
  return chapter.kind
}
