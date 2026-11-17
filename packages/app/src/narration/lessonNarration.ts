import { locale } from '../i18n/i18n'
import type { Chapter } from '../learn/lessonTypes'
import { AudioClipPlayer, type VoiceSignals } from './audioClipPlayer'
import { clipUrl, estimatedSeconds, type NarrationManifest } from './narrationManifest'
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
    // When the narrator is audible (the music steps back) and when a clip is still loading.
    voice: VoiceSignals,
  ) {
    this.player = new AudioClipPlayer(voice)
    soundToggle.addEventListener('change', () => {
      if (!soundToggle.checked) this.stop()
    })
  }

  chapter(lessonId: string, chapter: Chapter): void {
    this.say(lessonClipId(lessonId, chapter.id, chapter.focusPlanetId))
  }

  seconds(lessonId: string, chapter: Chapter): number {
    const recorded = this.manifest?.voices[narratorVoice()]?.clips[locale]?.[lessonClipId(lessonId, chapter.id, chapter.focusPlanetId)]
    return recorded?.seconds ?? estimatedSeconds(`${chapter.title} ${chapter.text}`)
  }

  // Fetches the chapter's clip ahead (the next one, while this one is read).
  prefetch(lessonId: string, chapter: Chapter): void {
    const url = this.recordedUrl(lessonClipId(lessonId, chapter.id, chapter.focusPlanetId))
    if (url) this.player.prefetch({ text: '', seconds: 0, url })
  }

  // Whether the clip being read is still loading.
  get isLoading(): boolean {
    return this.player.isLoading
  }

  sorted(sortingId: string): void {
    this.say(orderClipId(sortingId))
  }

  stop(): void {
    this.player.stop()
  }

  private say(id: string): void {
    this.stop()
    const recorded = this.manifest?.voices[narratorVoice()]?.clips[locale]?.[id]
    const url = this.recordedUrl(id)
    if (!recorded || !url) return
    this.player.play({ text: '', seconds: recorded.seconds, url }, () => {})
  }

  // The clip's address, if it is recorded and the narrator's voice is on.
  private recordedUrl(id: string): string | null {
    const voice = narratorVoice()
    const recorded = this.manifest?.voices[voice]?.clips[locale]?.[id]
    return this.soundToggle.checked && recorded ? clipUrl(voice, locale, id) : null
  }
}
