import { describe, expect, it } from 'vitest'
import { LessonProgress } from '../src/learn/lessonProgress'
import { MOON_PHASES_LESSON } from '../src/learn/lessons/moonPhases'

function memoryStorage() {
  const items = new Map<string, string>()
  return { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => void items.set(key, value) }
}

describe('LessonProgress', () => {
  const lesson = MOON_PHASES_LESSON
  const last = lesson.chapters.length - 1

  it('starts an unseen lesson at its first chapter, with nothing to report', () => {
    const progress = new LessonProgress(memoryStorage())
    expect(progress.resumeAt(lesson)).toBe(0)
    expect(progress.status(lesson)).toBe('')
  })

  it('resumes where the lesson was left', () => {
    const progress = new LessonProgress(memoryStorage())
    progress.record(lesson, 2)
    expect(progress.resumeAt(lesson)).toBe(2)
    expect(progress.status(lesson)).toBe('Continue at chapter 3')
  })

  it('starts a finished lesson from the top and calls it done, even when left mid-way afterwards', () => {
    const progress = new LessonProgress(memoryStorage())
    progress.record(lesson, last)
    progress.record(lesson, 1)
    expect(progress.resumeAt(lesson)).toBe(0)
    expect(progress.status(lesson)).toBe('Done')
  })

  it('keeps the progress across visits through the storage', () => {
    const storage = memoryStorage()
    new LessonProgress(storage).record(lesson, 4)
    expect(new LessonProgress(storage).resumeAt(lesson)).toBe(4)
  })

  it('works without storage, and with storage holding garbage', () => {
    const none = new LessonProgress(null)
    none.record(lesson, 3)
    expect(none.resumeAt(lesson)).toBe(3)
    const garbage = { getItem: () => '{not json', setItem: () => {} }
    expect(new LessonProgress(garbage).resumeAt(lesson)).toBe(0)
  })
})
