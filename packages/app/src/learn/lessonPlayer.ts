import type { Chapter, Lesson } from './lessonTypes'
import { dateAtScrubPosition } from './lessonTypes'

// Holds which lesson/chapter/scrub-position/latitude-preset is currently active. Pure state - no
// DOM access, no rendering - so main.ts's render loop and UI wiring can both read it each frame
// without this class needing to know about either.
export class LessonPlayer {
  private lesson: Lesson | null = null
  private chapterIndex = 0
  private _scrubT = 0

  load(lesson: Lesson): void {
    this.lesson = lesson
    this.chapterIndex = 0
    this._scrubT = 0
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

  get scrubT(): number {
    return this._scrubT
  }

  get currentDate(): Date {
    return dateAtScrubPosition(this.currentChapter.dateRange, this._scrubT)
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
    this._scrubT = 0
  }

  previousChapter(): void {
    if (!this.hasPreviousChapter) return
    this.chapterIndex -= 1
    this._scrubT = 0
  }

  setScrubT(t: number): void {
    this._scrubT = Math.min(Math.max(t, 0), 1)
  }
}
