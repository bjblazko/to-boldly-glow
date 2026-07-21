import type { CameraInputController } from '../camera/inputController'
import type { DockUI } from '../hud/dockUI'

export type AppMode = 'explore' | 'learn'

// Owns the top-level explore/learn mode switch: hides/relocates free-roam HUD via a
// `data-app-mode` attribute (see hud.css's `body[data-app-mode='learn']` rules), locks out free
// camera input, and closes any dock panel left open from free-roam use. Deliberately holds no
// lesson-specific state (current chapter, scrub position, latitude) — that's LessonPlayer's job
// (see learn/lessonPlayer.ts) — so this class stays a pure mode switch, reusable unchanged if a
// future lesson picker ever offers more than one lesson.
export class LearnModeController {
  private mode: AppMode = 'explore'

  constructor(
    private readonly body: HTMLElement,
    private readonly cameraInput: CameraInputController,
    private readonly dockUI: DockUI,
  ) {}

  get currentMode(): AppMode {
    return this.mode
  }

  enter(lessonId: string): void {
    this.mode = 'learn'
    this.body.dataset.appMode = 'learn'
    this.body.dataset.lessonId = lessonId
    this.cameraInput.setEnabled(false)
    this.dockUI.closeActivePanel()
  }

  exit(): void {
    this.mode = 'explore'
    this.body.dataset.appMode = 'explore'
    delete this.body.dataset.lessonId
    this.cameraInput.setEnabled(true)
  }
}
