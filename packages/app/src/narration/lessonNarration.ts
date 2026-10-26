import { locale } from '../i18n/i18n'
import type { Chapter } from '../learn/lessonTypes'
import { AudioClipPlayer } from './audioClipPlayer'
import { clipUrl, type NarrationManifest } from './narrationManifest'
import { lessonClipId, orderClipId } from './narrationSegments'
import { narratorVoice } from './narratorVoice'

// Reads the lessons out: each chapter as it is shown (a planet's in the tour's words for it), and
// the planets' new order when the lineup is sorted. One clip at a time - the next cuts the last
// short - in the chosen narrator's voice, unless Settings have the narrator's voice off. Text on
// the panel needs no subtitles; a clip not made yet is simply not read.
export class LessonNarration {
  private readonly player: AudioClipPlayer

  constructor(
    private readonly manifest: NarrationManifest | null,
    private readonly soundToggle: HTMLInputElement,
    // Hears when the narrator is audible, so the music can step back for it.
    speaking: (audible: boolean) => void,
  ) {
    this.player = new AudioClipPlayer(speaking)
    soundToggle.addEventListener('change', () => {
      if (!soundToggle.checked) this.stop()
    })
  }

  chapter(lessonId: string, chapter: Chapter): void {
    this.say(lessonClipId(lessonId, chapter.id, chapter.focusPlanetId))
  }

  sorted(sortingId: string): void {
    this.say(orderClipId(sortingId))
  }

  stop(): void {
    this.player.stop()
  }

  private say(id: string): void {
    this.stop()
    const voice = narratorVoice()
    const recorded = this.manifest?.voices[voice]?.clips[locale]?.[id]
    if (!this.soundToggle.checked || !recorded) return
    this.player.play({ text: '', seconds: recorded.seconds, url: clipUrl(voice, locale, id) }, () => {})
  }
}
