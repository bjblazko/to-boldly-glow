import type { Lesson } from './lessonTypes'

// How far a learner got in one lesson.
export interface LessonRecord {
  // The chapter they last looked at (0-based).
  chapter: number
  // Whether they reached the last chapter at some point.
  done: boolean
}

const STORAGE_KEY = 'toBoldlyGlow.lessonProgress'

// Remembers each lesson's last chapter, so the library can offer to continue there - in the
// browser's local storage when it has one (it may not: private windows, blocked site data).
export class LessonProgress {
  private readonly records: Record<string, LessonRecord>

  constructor(private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | null = browserStorage()) {
    this.records = readRecords(storage)
  }

  record(lesson: Lesson, chapterIndex: number): void {
    const done = (this.records[lesson.id]?.done ?? false) || chapterIndex === lesson.chapters.length - 1
    this.records[lesson.id] = { chapter: chapterIndex, done }
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.records))
    } catch {
      // Out of quota or blocked: progress just isn't kept across visits.
    }
  }

  // Where opening the lesson starts: where it was left, unless it was finished (then from the top).
  resumeAt(lesson: Lesson): number {
    const record = this.records[lesson.id]
    if (!record || record.done) return 0
    return Math.min(record.chapter, lesson.chapters.length - 1)
  }

  status(lesson: Lesson): string {
    const record = this.records[lesson.id]
    if (record?.done) return 'Done'
    if (record && record.chapter > 0) return `Continue at chapter ${Math.min(record.chapter, lesson.chapters.length - 1) + 1}`
    return ''
  }
}

function browserStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function readRecords(storage: Pick<Storage, 'getItem'> | null): Record<string, LessonRecord> {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(STORAGE_KEY) ?? '{}')
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, LessonRecord>) : {}
  } catch {
    return {}
  }
}
