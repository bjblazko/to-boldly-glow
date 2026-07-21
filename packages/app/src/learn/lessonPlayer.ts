import type { Chapter, Lesson } from './lessonTypes'

// Holds which lesson/chapter is currently active. Pure state - no DOM access, no rendering - so
// main.ts's render loop and UI wiring can both read it each frame without this class needing to
// know about either. No scrub/date state here (unlike the original real-astronomical-position
// design) - the staged redesign has nothing left for a user to scrub through; each chapter is a
// fixed season-phase orientation (see lessons/seasons.ts), not a real date range.
export class LessonPlayer {
  private lesson: Lesson | null = null
  private chapterIndex = 0

  load(lesson: Lesson): void {
    this.lesson = lesson
    this.chapterIndex = 0
  }

  get currentLesson(): Lesson {
    if (!this.lesson) throw new Error('LessonPlayer.load() must be called before use.')
    return this.lesson
  }

  get currentChapterIndex(): number {
    return this.chapterIndex
  }

  get currentChapter(): Chapter {
    return this.currentLesson.chapters[this.chapterIndex]
  }

  get hasPreviousChapter(): boolean {
    return this.chapterIndex > 0
  }

  get hasNextChapter(): boolean {
    return this.chapterIndex < this.currentLesson.chapters.length - 1
  }

  nextChapter(): void {
    if (!this.hasNextChapter) return
    this.chapterIndex += 1
  }

  previousChapter(): void {
    if (!this.hasPreviousChapter) return
    this.chapterIndex -= 1
  }
}
