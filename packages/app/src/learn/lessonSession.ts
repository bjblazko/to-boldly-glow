import type { CameraDirector, CameraSnapshot } from '../camera/cameraDirector'
import type { Viewpoint } from '../camera/viewpoint'
import type { DisplaySettings, LessonDisplaySnapshot } from '../hud/displaySettings'
import { findPlanet, type SceneLayout } from '../scene/sceneLayout'
import type { Ephemeris } from '../time/ephemeris'
import type { LearnModeController } from './learnModeController'
import type { LessonCamera } from './lessonCamera'
import type { LessonPanel } from './lessonPanel'
import { LessonPlayer } from './lessonPlayer'
import { isEclipseKind, type Chapter, type Lesson } from './lessonTypes'
import { LESSONS_BY_ID } from './lessons/lessonCatalog'
import type { EclipseLabels } from './eclipse/eclipseLabels'
import { EclipseLesson } from './eclipse/eclipseLesson'
import type { GroundSky } from './eclipse/groundSky'
import { OrbitOverlay } from './seasons/orbitOverlay'
import type { SeasonsLabels } from './seasons/seasonsLabels'
import { SeasonsScene } from './seasons/seasonsScene'
import { StagedOverlay } from './seasons/stagedOverlay'
import { sizesLayout } from './sizes/sizesLineup'

export interface LessonSessionParts {
  modeController: LearnModeController
  camera: CameraDirector
  lessonCamera: LessonCamera
  display: DisplaySettings
  panel: LessonPanel
  labels: SeasonsLabels
  eclipseLabels: EclipseLabels
}

export interface LessonGpu {
  device: GPUDevice
  linePipeline: GPURenderPipeline
  groundSky: GroundSky
}

export interface LessonOverlayFrame {
  nowSeconds: number
  // The Sun's own brightness this frame (see bodies/sunSurface.ts).
  sunBrightness: number
}

export interface LessonPickerUi {
  learnButton: HTMLButtonElement
  picker: HTMLElement
}

// What a lesson borrowed from the explore view and gives back when it ends.
interface BorrowedState {
  camera: CameraSnapshot
  display: LessonDisplaySnapshot
}

// Runs the learn mode: opening a lesson from the picker, moving between its chapters, staging each
// chapter's scene, and handing the camera and display settings back when the lesson ends.
export class LessonSession {
  private readonly player = new LessonPlayer()
  private readonly seasons = new SeasonsScene()
  private readonly stagedOverlay: StagedOverlay
  private readonly orbitOverlay: OrbitOverlay
  private readonly eclipse: EclipseLesson
  private borrowed: BorrowedState | null = null

  constructor(
    private readonly parts: LessonSessionParts,
    private readonly ui: LessonPickerUi,
    gpu: LessonGpu,
  ) {
    this.stagedOverlay = new StagedOverlay(gpu.device, gpu.linePipeline)
    this.orbitOverlay = new OrbitOverlay(gpu.device, gpu.linePipeline)
    this.eclipse = new EclipseLesson(gpu, gpu.groundSky, parts.eclipseLabels)
    ui.learnButton.addEventListener('click', () => (this.active ? this.end() : this.togglePicker()))
    ui.picker.querySelectorAll<HTMLButtonElement>('.hud-lesson-picker-item').forEach((item) => {
      item.addEventListener('click', () => {
        const lesson = LESSONS_BY_ID[item.dataset.lessonId ?? '']
        if (lesson) this.start(lesson)
      })
    })
    parts.panel.previousButton.addEventListener('click', () => this.goToChapter(() => this.player.previousChapter()))
    parts.panel.nextButton.addEventListener('click', () => this.goToChapter(() => this.player.nextChapter()))
  }

  get active(): boolean {
    return this.parts.modeController.currentMode === 'learn'
  }

  private get chapter(): Chapter {
    return this.player.currentChapter
  }

  // The camera framing depends on the window's shape (see LessonCamera).
  reframe(): void {
    if (this.active) this.parts.lessonCamera.frame(this.chapter.kind)
  }

  update(deltaSeconds: number): void {
    if (!this.active) return
    const { kind } = this.chapter
    if (isEclipseKind(kind)) this.eclipse.update(deltaSeconds, kind)
    else if (kind !== 'sizes') this.seasons.update(deltaSeconds, kind)
  }

  // The lesson's scene, or null outside lessons (the explore view's real solar system).
  layout(ephemeris: Ephemeris): SceneLayout | null {
    if (!this.active) return null
    const { kind } = this.chapter
    if (isEclipseKind(kind)) return this.eclipse.layout(kind, ephemeris)
    return kind === 'sizes' ? sizesLayout(ephemeris) : this.seasons.layout(kind, ephemeris)
  }

  updateOverlays(layout: SceneLayout, viewpoint: Viewpoint, { nowSeconds, sunBrightness }: LessonOverlayFrame): void {
    const earth = findPlanet(layout, 'earth')
    const kind = this.active ? this.chapter.kind : null
    const frame = { viewpoint, nowSeconds, labels: this.parts.labels }
    if (earth && kind === 'staged') this.stagedOverlay.update(earth, this.player.currentLesson.markerLatitudeDegrees, frame)
    else if (earth && kind === 'orbit') this.orbitOverlay.update(earth, frame)
    else this.parts.labels.hideAll()
    if (kind && isEclipseKind(kind)) this.eclipse.updateOverlays(layout, kind, { viewpoint, nowSeconds, sunBrightness })
    else this.eclipse.hideLabels()
  }

  // Right after the sky's backdrop, before the Sun, planets and moons.
  drawBehindBodies(pass: GPURenderPassEncoder): void {
    if (this.active && isEclipseKind(this.chapter.kind)) this.eclipse.drawBehindBodies(pass, this.chapter.kind)
  }

  // After every body and what surrounds them, before the overlay lines.
  drawInFrontOfBodies(pass: GPURenderPassEncoder): void {
    if (this.active && isEclipseKind(this.chapter.kind)) this.eclipse.drawInFrontOfBodies(pass, this.chapter.kind)
  }

  // Expects the line pipeline to be set on the pass.
  drawOverlays(pass: GPURenderPassEncoder): void {
    if (!this.active) return
    const { kind } = this.chapter
    if (kind === 'staged') this.stagedOverlay.draw(pass)
    else if (kind === 'orbit') this.orbitOverlay.draw(pass)
    else if (isEclipseKind(kind)) this.eclipse.drawOverlays(pass, kind)
  }

  private togglePicker(): void {
    this.ui.picker.hidden = !this.ui.picker.hidden
    this.ui.learnButton.classList.toggle('is-active', !this.ui.picker.hidden)
  }

  private start(lesson: Lesson): void {
    const { camera, display, modeController, lessonCamera, panel } = this.parts
    this.ui.picker.hidden = true
    this.player.load(lesson)
    this.borrowed = { camera: camera.takeOverForLesson(), display: display.clearForLesson() }
    modeController.enter(lesson.id)
    this.ui.learnButton.classList.add('is-active')
    lessonCamera.frame(this.chapter.kind)
    this.seasons.start(this.chapter.seasonPhaseDegrees)
    this.eclipse.start(this.chapter)
    panel.visible = true
    panel.show(this.player)
  }

  private end(): void {
    const { camera, display, modeController, lessonCamera, panel } = this.parts
    modeController.exit()
    if (this.borrowed) {
      camera.restoreAfterLesson(this.borrowed.camera)
      lessonCamera.release()
      display.restoreAfterLesson(this.borrowed.display)
      this.borrowed = null
    }
    panel.visible = false
    this.ui.picker.hidden = true
    this.ui.learnButton.classList.remove('is-active')
  }

  // A new chapter of the same kind turns Earth's axis (or moves the Moon) smoothly with the camera
  // standing still; a change of kind re-frames the camera and snaps to the new scene.
  private goToChapter(navigate: () => void): void {
    const previousKind = this.chapter.kind
    navigate()
    const kindChanged = this.chapter.kind !== previousKind
    if (kindChanged) this.parts.lessonCamera.frame(this.chapter.kind)
    this.seasons.showSeason(this.chapter.seasonPhaseDegrees, kindChanged)
    this.eclipse.showChapter(this.chapter, kindChanged)
    this.parts.panel.show(this.player)
  }
}
