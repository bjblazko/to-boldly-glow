import type { CameraDirector, CameraSnapshot } from '../camera/cameraDirector'
import type { Viewpoint } from '../camera/viewpoint'
import type { DisplaySettings, LessonDisplaySnapshot } from '../hud/displaySettings'
import { findPlanet, type SceneLayout } from '../scene/sceneLayout'
import type { Ephemeris } from '../time/ephemeris'
import type { LearnModeController } from './learnModeController'
import type { LessonCamera } from './lessonCamera'
import type { LessonPanel } from './lessonPanel'
import { LessonPlayer } from './lessonPlayer'
import type { Chapter, Lesson } from './lessonTypes'
import { LESSONS_BY_ID } from './lessons/lessonCatalog'
import { OrbitOverlay } from './seasons/orbitOverlay'
import type { SeasonsLabels } from './seasons/seasonsLabels'
import { isSeasonsKind, SeasonsScene } from './seasons/seasonsScene'
import { StagedOverlay } from './seasons/stagedOverlay'
import { sizesLayout } from './sizes/sizesLineup'
import type { StagedLessonScene } from './stagedLessonScene'

export interface LessonSessionParts {
  modeController: LearnModeController
  camera: CameraDirector
  lessonCamera: LessonCamera
  display: DisplaySettings
  panel: LessonPanel
  labels: SeasonsLabels
  // The lessons that stage their own Sun, Earth and Moon (the solar eclipse, the Moon's phases).
  stagedScenes: StagedLessonScene[]
}

export interface LessonGpu {
  device: GPUDevice
  linePipeline: GPURenderPipeline
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
  private borrowed: BorrowedState | null = null

  constructor(
    private readonly parts: LessonSessionParts,
    private readonly ui: LessonPickerUi,
    gpu: LessonGpu,
  ) {
    this.stagedOverlay = new StagedOverlay(gpu.device, gpu.linePipeline)
    this.orbitOverlay = new OrbitOverlay(gpu.device, gpu.linePipeline)
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

  // The staged lesson showing the current chapter, if one does.
  private get stagedScene(): StagedLessonScene | undefined {
    if (!this.active) return undefined
    const { kind } = this.chapter
    return this.parts.stagedScenes.find((scene) => scene.handles(kind))
  }

  // The camera framing depends on the window's shape (see LessonCamera).
  reframe(): void {
    if (this.active) this.frameCamera()
  }

  // A view from the ground may move with its scene, so the camera follows it every frame.
  update(deltaSeconds: number): void {
    if (!this.active) return
    const { kind } = this.chapter
    const staged = this.stagedScene
    if (staged) {
      staged.update(deltaSeconds, this.chapter)
      if (staged.groundShot(this.chapter)) this.frameCamera()
    } else if (isSeasonsKind(kind)) this.seasons.update(deltaSeconds, kind)
  }

  // The lesson's scene, or null outside lessons (the explore view's real solar system).
  layout(ephemeris: Ephemeris): SceneLayout | null {
    if (!this.active) return null
    const { kind } = this.chapter
    const staged = this.stagedScene
    if (staged) return staged.layout(this.chapter, ephemeris)
    return isSeasonsKind(kind) ? this.seasons.layout(kind, ephemeris) : sizesLayout(ephemeris)
  }

  updateOverlays(layout: SceneLayout, viewpoint: Viewpoint, { nowSeconds, sunBrightness }: LessonOverlayFrame): void {
    const earth = findPlanet(layout, 'earth')
    const kind = this.active ? this.chapter.kind : null
    const frame = { viewpoint, nowSeconds, labels: this.parts.labels }
    if (earth && kind === 'staged') this.stagedOverlay.update(earth, this.player.currentLesson.markerLatitudeDegrees, frame)
    else if (earth && kind === 'orbit') this.orbitOverlay.update(earth, frame)
    else this.parts.labels.hideAll()
    const staged = this.stagedScene
    for (const scene of this.parts.stagedScenes) {
      if (scene === staged) scene.updateOverlays(layout, this.chapter, { viewpoint, nowSeconds, sunBrightness })
      else scene.hideOverlays()
    }
  }

  // Right after the sky's backdrop, before the Sun, planets and moons.
  drawBehindBodies(pass: GPURenderPassEncoder): void {
    this.stagedScene?.drawBehindBodies(pass, this.chapter)
  }

  // After every body and what surrounds them, before the overlay lines.
  drawInFrontOfBodies(pass: GPURenderPassEncoder): void {
    this.stagedScene?.drawInFrontOfBodies(pass, this.chapter)
  }

  // Expects the line pipeline to be set on the pass.
  drawOverlays(pass: GPURenderPassEncoder): void {
    if (!this.active) return
    const { kind } = this.chapter
    if (kind === 'staged') this.stagedOverlay.draw(pass)
    else if (kind === 'orbit') this.orbitOverlay.draw(pass)
    else this.stagedScene?.drawOverlays(pass, this.chapter)
  }

  private frameCamera(): void {
    this.parts.lessonCamera.frame(this.chapter.kind, this.stagedScene?.groundShot(this.chapter))
  }

  private togglePicker(): void {
    this.ui.picker.hidden = !this.ui.picker.hidden
    this.ui.learnButton.classList.toggle('is-active', !this.ui.picker.hidden)
  }

  private start(lesson: Lesson): void {
    const { camera, display, modeController, panel } = this.parts
    this.ui.picker.hidden = true
    this.player.load(lesson)
    this.borrowed = { camera: camera.takeOverForLesson(), display: display.clearForLesson() }
    modeController.enter(lesson.id)
    this.ui.learnButton.classList.add('is-active')
    this.seasons.start(this.chapter.seasonPhaseDegrees)
    this.stagedScene?.start(this.chapter)
    this.frameCamera()
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
  // standing still - or, from the ground, turning with the sky; a change of kind re-frames the camera
  // and snaps to the new scene.
  private goToChapter(navigate: () => void): void {
    const previousKind = this.chapter.kind
    navigate()
    const kindChanged = this.chapter.kind !== previousKind
    this.seasons.showSeason(this.chapter.seasonPhaseDegrees, kindChanged)
    this.stagedScene?.showChapter(this.chapter, kindChanged)
    if (kindChanged) this.frameCamera()
    this.parts.panel.show(this.player)
  }
}
