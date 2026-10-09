import type { DockUI } from '../hud/dockUI'
import type { EntityFinder } from '../search/entityFinder'

export type AppMode = 'explore' | 'learn'

export interface LessonCameraInput {
  setEnabled(enabled: boolean): void
  setPickEnabled(enabled: boolean): void
}

// Owns the top-level explore/learn mode switch: swaps the explore dock for the lesson dock via a
// `data-app-mode` attribute (see hud.css's `body[data-app-mode='learn']` rules), takes the camera
// away from the user until the lesson has framed its shot (LessonSession hands back what a shot
// allows), switches off double-click fly-to and the object finder, and closes any dock panel left
// open. Deliberately holds no lesson-specific state (current chapter) - that's LessonPlayer's job
// (see learn/lessonPlayer.ts) - so this class stays a pure mode switch.
export class LearnModeController {
  private mode: AppMode = 'explore'

  constructor(
    private readonly body: HTMLElement,
    private readonly cameraInput: LessonCameraInput,
    private readonly dockUI: DockUI,
    private readonly entityFinder: EntityFinder,
  ) {}

  get currentMode(): AppMode {
    return this.mode
  }

  enter(lessonId: string): void {
    this.mode = 'learn'
    this.body.dataset.appMode = 'learn'
    this.body.dataset.lessonId = lessonId
    this.cameraInput.setEnabled(false)
    this.cameraInput.setPickEnabled(false)
    // The finder must be robustly unusable in learn mode, not just out of sight in the hidden
    // explore dock's panel - see EntityFinder.setEnabled.
    this.entityFinder.setEnabled(false)
    this.dockUI.closeActivePanel()
  }

  exit(): void {
    this.mode = 'explore'
    this.body.dataset.appMode = 'explore'
    delete this.body.dataset.lessonId
    this.cameraInput.setEnabled(true)
    this.cameraInput.setPickEnabled(true)
    this.entityFinder.setEnabled(true)
    this.dockUI.closeActivePanel()
  }
}
