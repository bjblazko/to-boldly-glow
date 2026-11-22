import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { APOLLO11_LESSON } from '../src/learn/lessons/apollo11'
import ORIGINAL_SECONDS from '../src/learn/lessons/apollo11Audio.json'
import { messagesFor } from '../src/i18n/i18n'

describe('the Apollo 11 lesson’s recordings from the time', () => {
  it('belong to a chapter each, with their words and speaker in both languages, and their files', () => {
    for (const [id, seconds] of Object.entries(ORIGINAL_SECONDS)) {
      const chapter = APOLLO11_LESSON.chapters.find((entry) => entry.id === id)
      expect(chapter?.original).toMatchObject({ clip: `apollo11/${id}`, seconds })
      for (const locale of ['en', 'de'] as const) expect((messagesFor(locale).lessons.apollo11.original as Record<string, { words: string; speaker: string }>)[id].words.length).toBeGreaterThan(10)
      for (const extension of ['webm', 'mp3']) expect(existsSync(new URL(`../public/audio/apollo11/${id}.${extension}`, import.meta.url))).toBe(true)
    }
  })

  it('has its words in German as long as in English, so the subtitles keep pace', () => {
    const [en, de] = (['en', 'de'] as const).map((locale) => messagesFor(locale).lessons.apollo11.original as Record<string, { words: string }>)
    for (const id of Object.keys(en)) expect(de[id].words.split(/[.!?]/).length).toBe(en[id].words.split(/[.!?]/).length)
  })
})
