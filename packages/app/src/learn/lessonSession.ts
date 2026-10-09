import type { CameraDirector, CameraSnapshot } from '../camera/cameraDirector'
import type { Viewpoint } from '../camera/viewpoint'
import type { DisplaySettings, LessonDisplaySnapshot } from '../hud/displaySettings'
import { findPlanet, type SceneLayout } from '../scene/sceneLayout'
import type { Ephemeris } from '../time/ephemeris'
import type { LearnModeController } from './learnModeController'
import type { LessonCamera } from './lessonCamera'
import type { LessonPanel } from './lessonPanel'
import { LessonPlayer } from './lessonPlayer'
import type { LessonProgress } from './lessonProgress'
import type { Chapter, Lesson } from './lessonTypes'
import type { LessonViewControls } from './lessonViewControls'
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
  viewControls: LessonViewControls
  progress: LessonProgress
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

// What a lesson borrowed from the explore view and gives back when it ends.
interface BorrowedState {
  camera: CameraSnapshot
  display: LessonDisplaySnapshot
}

// Runs a lesson: starting it, moving between its chapters, staging each chapter's scene and framing
// the camera on it, and handing the camera and display settings back when the lesson ends.
export class LessonSession {
  private readonly player = new LessonPlayer()
  private readonly seasons = new SeasonsScene()
  private readonly stagedOverlay: StagedOverlay
  private readonly orbitOverlay: OrbitOverlay
  private borrowed: BorrowedState | null = null
  // Whether the current shot stands still for the user (a view from the ground) - see frameCamera.
  private viewFixed: boolean | null = null

  constructor(
    private readonly parts: LessonSessionParts,
    gpu: LessonGpu,
  ) {
    this.stagedOverlay = new StagedOverlay(gpu.device, gpu.linePipeline)
    this.orbitOverlay = new OrbitOverlay(gpu.device, gpu.linePipeline)
    parts.panel.previousButton.addEventListener('click', () => this.goToChapter(() => this.player.previousChapter()))
    parts.panel.nextButton.addEventListener('click', () => this.goToChapter(() => this.player.nextChapter()))
    parts.panel.onChapterPicked = (index) => this.goToChapter(() => this.player.goToChapter(index))
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
    this.parts.lessonCamera.update(deltaSeconds)
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

  // Brings the chapter's own framing back after the user zoomed or turned the view.
  resetView(): void {
    if (this.active) this.frameCamera()
  }

  // Frames the chapter's shot, or flies there (glide). The user may look around a shot from space; a
  // view from the ground is the observer's own eye and stands still, so camera input is off there.
  private frameCamera(glide = false): void {
    const groundShot = this.stagedScene?.groundShot(this.chapter)
    this.parts.lessonCamera.frame(this.chapter.kind, groundShot, { focusPlanetId: this.chapter.focusPlanetId, glide })
    const fixed = Boolean(groundShot)
    if (fixed === this.viewFixed) return
    this.viewFixed = fixed
    this.parts.camera.setInputEnabled(!fixed)
    this.parts.viewControls.setFixed(fixed)
  }

  // Opens a lesson at the given chapter; a lesson already running ends first.
  start(lesson: Lesson, chapterIndex = 0): void {
    const { camera, display, modeController, panel } = this.parts
    if (this.active) this.end()
    this.player.load(lesson, chapterIndex)
    this.borrowed = { camera: camera.takeOverForLesson(), display: display.clearForLesson() }
    modeController.enter(lesson.id)
    this.seasons.start(this.chapter.seasonPhaseDegrees)
    this.stagedScene?.start(this.chapter)
    this.viewFixed = null
    this.frameCamera()
    panel.visible = true
    this.showChapter()
  }

  end(): void {
    const { camera, display, modeController, lessonCamera, panel } = this.parts
    if (!this.active) return
    modeController.exit()
    if (this.borrowed) {
      camera.restoreAfterLesson(this.borrowed.camera)
      lessonCamera.release()
      display.restoreAfterLesson(this.borrowed.display)
      this.borrowed = null
    }
    panel.visible = false
  }

  private showChapter(): void {
    this.parts.panel.show(this.player)
    this.parts.progress.record(this.player.currentLesson, this.player.currentChapterIndex)
  }

  // A new chapter of the same kind turns Earth's axis (or moves the Moon) smoothly with the camera
  // standing still - or, from the ground, turning with the sky - and in the sizes lineup flies the
  // camera to the chapter's planet; a change of kind re-frames the camera and snaps to the new scene.
  private goToChapter(navigate: () => void): void {
    const previous = this.chapter
    navigate()
    const kindChanged = this.chapter.kind !== previous.kind
    this.seasons.showSeason(this.chapter.seasonPhaseDegrees, kindChanged)
    this.stagedScene?.showChapter(this.chapter, kindChanged)
    if (kindChanged) this.frameCamera()
    else if (this.chapter.focusPlanetId !== previous.focusPlanetId) this.frameCamera(true)
    this.showChapter()
  }
}
