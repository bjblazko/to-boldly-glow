import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Chapter } from '../src/learn/lessonTypes'
import { LessonNarration } from '../src/narration/lessonNarration'
import type { NarrationManifest } from '../src/narration/narrationManifest'
import type { ClipPlayer, NarrationClip } from '../src/narration/narrator'

class FakePlayer implements ClipPlayer {
  playing: { clip: NarrationClip; onEnded: () => void } | null = null
  played: string[] = []
  isLoading = false
  play(clip: NarrationClip, onEnded: () => void): void {
    this.playing = { clip, onEnded }
    this.played.push(clip.url ?? '')
  }
  prefetch(): void {}
  elapsed(): number {
    return 0
  }
  stop(): void {
    this.playing = null
  }
  pause(): void {}
  resume(): void {}
  end(): void {
    const playing = this.playing
    this.playing = null
    playing?.onEnded()
  }
}

const manifest = { model: '', encoding: '', voices: { lyra: { clips: { en: { 'lessons/apollo11/landing': { seconds: 30, hash: '' } } } } } } as unknown as NarrationManifest
const landing = {
  id: 'landing',
  title: 'The landing',
  text: '...',
  original: { clip: 'apollo11/landing', seconds: 8, words: 'Houston, Tranquility Base here. The Eagle has landed.', speaker: 'Neil Armstrong, 20 July 1969' },
} as unknown as Chapter

function narration() {
  const player = new FakePlayer()
  const shown: (string | null)[] = []
  const toggle = { checked: true, addEventListener: () => {} } as unknown as HTMLInputElement
  const voice = new LessonNarration(manifest, toggle, { player, view: { show: (words, speaker) => shown.push(words && `${words} | ${speaker}`) } })
  return { player, shown, voice }
}

describe('original audio in a lesson', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('plays after the narrator has read the chapter, with its words and who said them', () => {
    const { player, shown, voice } = narration()
    voice.chapter('apollo11', landing)
    expect(player.played).toEqual([expect.stringContaining('narration/lyra/en/lessons/apollo11/landing.')])
    player.end()
    expect(player.played.at(-1)).toContain('audio/apollo11/landing.')
    expect(shown.at(-1)).toBe('Houston, Tranquility Base here. The Eagle has landed. | Neil Armstrong, 20 July 1969')
    player.end()
    expect(shown.at(-1)).toBeNull()
  })

  it('counts the clip in the chapter’s time', () => {
    const { voice } = narration()
    expect(voice.seconds('apollo11', landing)).toBeGreaterThanOrEqual(38)
  })

  it('is cut short by the next chapter, and can be heard again on request', () => {
    const { player, shown, voice } = narration()
    voice.chapter('apollo11', landing)
    player.end()
    voice.chapter('apollo11', { ...landing, id: 'surface', original: undefined })
    expect(shown.at(-1)).toBeNull()
    voice.original(landing)
    expect(player.played.at(-1)).toContain('audio/apollo11/landing.')
  })
})
