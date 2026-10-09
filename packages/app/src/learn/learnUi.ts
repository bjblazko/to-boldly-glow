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

// The Explore / Learn switch and the lesson library. Learn opens the library (over a running lesson
// too, to switch lessons); picking a lesson starts it where it was left; Explore closes the library
// and ends the lesson. Learn reads as on while the library is open or a lesson runs.
export class LearnUi {
  private readonly library: LessonLibrary

  constructor(
    private readonly elements: LearnUiElements,
    private readonly session: LessonSession,
    private readonly progress: LessonProgress,
    private readonly closeSheet: () => void,
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
    this.session.start(lesson, this.progress.resumeAt(lesson))
    this.refresh()
  }

  private openLibrary(): void {
    this.closeSheet()
    this.library.open()
    this.refresh()
  }

  private closeLibrary(): void {
    this.library.close()
    this.refresh()
    this.elements.learnButton.focus()
  }

  private refresh(): void {
    const learning = this.library.isOpen || this.session.active
    for (const [button, on] of [
      [this.elements.exploreButton, !learning],
      [this.elements.learnButton, learning],
    ] as const) {
      button.classList.toggle('is-active', on)
      button.setAttribute('aria-pressed', String(on))
    }
  }
}
