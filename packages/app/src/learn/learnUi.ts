import type { ModeButtons } from '../hud/modeButtons'
import { LessonLibrary, type LessonLibraryElements } from './lessonLibrary'
import type { LessonProgress } from './lessonProgress'
import type { LessonSession } from './lessonSession'
import type { Lesson } from './lessonTypes'
import { LESSON_TOPICS } from './lessons/lessonCatalog'

export interface LearnUiElements {
  exploreButton: HTMLButtonElement
  learnButton: HTMLButtonElement
  // The lesson dock's Library button.
  libraryButton: HTMLButtonElement
  library: LessonLibraryElements
}

// The Learn mode's side of the top switch, and the lesson library. Learn opens the library (over a
// running lesson too, to switch lessons); picking a lesson starts it where it was left; Explore
// closes the library and ends the lesson. Learn reads as on while the library is open or a lesson
// runs.
export class LearnUi {
  private readonly library: LessonLibrary

  constructor(
    private readonly elements: LearnUiElements,
    private readonly session: LessonSession,
    private readonly progress: LessonProgress,
    // The dock's open panel, closed under the library; the top switch, told when Learn is on.
    private readonly shell: { closeSheet(): void; modes: ModeButtons },
  ) {
    this.library = new LessonLibrary(elements.library, LESSON_TOPICS, progress, {
      onPick: (lesson) => this.openLesson(lesson),
      onClose: () => this.closeLibrary(),
    })
    elements.exploreButton.addEventListener('click', () => this.explore())
    elements.learnButton.addEventListener('click', () => (this.library.isOpen ? this.closeLibrary() : this.openLibrary()))
    elements.libraryButton.addEventListener('click', () => this.openLibrary())
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.library.isOpen) this.closeLibrary()
    })
  }

  // Back to exploring: no library, no lesson.
  explore(): void {
    this.library.close()
    this.session.end()
    this.refresh()
  }

  openLesson(lesson: Lesson): void {
    this.library.close()
    this.session.start(lesson, this.progress.resumeAt(lesson), this.progress.sortingOf(lesson))
    this.refresh()
  }

  // Out of the way of another mode's menu: the library closes, a running lesson stays.
  hideLibrary(): void {
    this.library.close()
    this.refresh()
  }

  private openLibrary(): void {
    this.shell.closeSheet()
    this.library.open()
    this.refresh()
  }

  private closeLibrary(): void {
    this.library.close()
    this.refresh()
    this.elements.learnButton.focus()
  }

  private refresh(): void {
    this.shell.modes.setLearning(this.library.isOpen || this.session.active)
  }
}
