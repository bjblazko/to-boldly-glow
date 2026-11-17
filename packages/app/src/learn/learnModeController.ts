import type { DockUI } from '../hud/dockUI'

export type AppMode = 'explore' | 'learn'

export interface LessonCameraInput {
  setEnabled(enabled: boolean): void
  setPickEnabled(enabled: boolean): void
}

// Owns the switch between exploring and a lesson: marks it on the body (`data-app-mode`, and the
// bar's context through `lessonActive`), takes the camera away from the user until the lesson has
// framed its shot (LessonSession hands back what a shot allows), switches off double-click fly-to,
// and closes any bar panel left open. Deliberately holds no lesson-specific state (current chapter) - that's LessonPlayer's job
// (see learn/lessonPlayer.ts) - so this class stays a pure mode switch.
export class LearnModeController {
  private mode: AppMode = 'explore'

  constructor(
    private readonly body: HTMLElement,
    private readonly cameraInput: LessonCameraInput,
    private readonly dockUI: DockUI,
    private readonly lessonActive: (active: boolean) => void,
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
    this.lessonActive(true)
    this.dockUI.closeActivePanel()
  }

  exit(): void {
    this.mode = 'explore'
    this.body.dataset.appMode = 'explore'
    delete this.body.dataset.lessonId
    this.cameraInput.setEnabled(true)
    this.cameraInput.setPickEnabled(true)
    this.lessonActive(false)
    this.dockUI.closeActivePanel()
  }
}
