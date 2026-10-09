import { describe, expect, it } from 'vitest'
import { LessonPlayer } from '../src/learn/lessonPlayer'
import { MOON_PHASES_LESSON } from '../src/learn/lessons/moonPhases'

describe('LessonPlayer chapter jumps', () => {
  it('loads a lesson at a given chapter, clamped to the lesson', () => {
    const player = new LessonPlayer()
    player.load(MOON_PHASES_LESSON, 2)
    expect(player.currentChapterIndex).toBe(2)
    player.load(MOON_PHASES_LESSON, 99)
    expect(player.currentChapterIndex).toBe(MOON_PHASES_LESSON.chapters.length - 1)
    player.load(MOON_PHASES_LESSON, -3)
    expect(player.currentChapterIndex).toBe(0)
  })

  it('jumps to any chapter, ignoring indexes outside the lesson', () => {
    const player = new LessonPlayer()
    player.load(MOON_PHASES_LESSON)
    player.goToChapter(4)
    expect(player.currentChapter.id).toBe('first-quarter')
    player.goToChapter(7)
    expect(player.currentChapterIndex).toBe(4)
  })
})
