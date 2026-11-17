import type { LessonProgress } from './lessonProgress'
import type { LessonSession } from './lessonSession'
import type { Lesson } from './lessonTypes'

// Starting and leaving lessons: a lesson opens where it was left (and in the order its chapters
// were last in); leaving ends it and returns to exploring.
export class LearnUi {
  constructor(
    private readonly session: LessonSession,
    private readonly progress: LessonProgress,
  ) {}

  get active(): boolean {
    return this.session.active
  }

  // Back to exploring: no lesson.
  explore(): void {
    this.session.end()
  }

  openLesson(lesson: Lesson): void {
    this.session.start(lesson, this.progress.resumeAt(lesson), this.progress.sortingOf(lesson))
  }
}
