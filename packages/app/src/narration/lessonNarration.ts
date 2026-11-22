import { locale } from '../i18n/i18n'
import type { Chapter } from '../learn/lessonTypes'
import { clipUrl, estimatedSeconds, originalAudioUrl, type NarrationManifest } from './narrationManifest'
import { lessonClipId, orderClipId } from './narrationSegments'
import type { ClipPlayer } from './narrator'
import { narratorVoice } from './narratorVoice'
import { cueAt, subtitleCues } from './subtitles'

// Where a recording's words show while it plays: the words (null: none) and who says them.
export interface OriginalAudioView {
  show(words: string | null, speaker: string | null): void
}

// A moment of quiet between the narrator and the recording.
const ORIGINAL_PAUSE_SECONDS = 1
const SUBTITLE_TICK_MS = 200

// Reads the lessons out: each chapter as it is shown (a planet's in the tour's words for it), and
// the planets' new order when the lineup is sorted. One clip at a time - the next cuts the last
// short - in the chosen narrator's voice, unless Settings have the narrator's voice off. Text on
// the panel needs no subtitles; a clip not made yet is simply not read. A chapter with a recording
// from the time plays it after the narrator, its words shown as it plays (they are in English).
export class LessonNarration {
  private readonly player: ClipPlayer
  private readonly view: OriginalAudioView
  private ticker: ReturnType<typeof setInterval> | undefined

  constructor(
    private readonly manifest: NarrationManifest | null,
    private readonly soundToggle: HTMLInputElement,
    { player, view }: { player: ClipPlayer; view: OriginalAudioView },
  ) {
    this.player = player
    this.view = view
    soundToggle.addEventListener('change', () => {
      if (!soundToggle.checked) this.stop()
    })
  }

  chapter(lessonId: string, chapter: Chapter): void {
    const original = chapter.original
    this.say(lessonClipId(lessonId, chapter.id, chapter.focusPlanetId), original ? () => this.original({ original }) : undefined)
  }

  seconds(lessonId: string, chapter: Chapter): number {
    const recorded = this.manifest?.voices[narratorVoice()]?.clips[locale]?.[lessonClipId(lessonId, chapter.id, chapter.focusPlanetId)]
    const read = recorded?.seconds ?? estimatedSeconds(`${chapter.title} ${chapter.text}`)
    return read + (chapter.original ? ORIGINAL_PAUSE_SECONDS + chapter.original.seconds : 0)
  }

  // Plays the chapter's recording now (the panel's button: heard again).
  original({ original }: Pick<Chapter, 'original'>): void {
    if (!original) return
    this.stop()
    const cues = subtitleCues(original.words, original.seconds)
    const show = () => this.view.show(cueAt(cues, this.player.elapsed())?.text ?? null, original.speaker)
    this.player.play({ text: original.words, seconds: original.seconds, url: originalAudioUrl(original.clip) }, () => this.quiet())
    this.ticker = setInterval(show, SUBTITLE_TICK_MS)
    show()
  }

  // Fetches the chapter's clip ahead (the next one, while this one is read).
  prefetch(lessonId: string, chapter: Chapter): void {
    const url = this.recordedUrl(lessonClipId(lessonId, chapter.id, chapter.focusPlanetId))
    if (url) this.player.prefetch?.({ text: '', seconds: 0, url })
  }

  // Whether the clip being read is still loading.
  get isLoading(): boolean {
    return this.player.isLoading ?? false
  }

  sorted(sortingId: string): void {
    this.say(orderClipId(sortingId))
  }

  stop(): void {
    this.player.stop()
    this.quiet()
  }

  private quiet(): void {
    clearInterval(this.ticker)
    this.ticker = undefined
    this.view.show(null, null)
  }

  // The narrator's clip, then (if any) what follows it; with the voice off, nothing.
  private say(id: string, then?: () => void): void {
    this.stop()
    const recorded = this.manifest?.voices[narratorVoice()]?.clips[locale]?.[id]
    const url = this.recordedUrl(id)
    if (!this.soundToggle.checked) return
    if (!recorded || !url) return then?.()
    this.player.play({ text: '', seconds: recorded.seconds, url }, () => then?.())
  }

  // The clip's address, if it is recorded and the narrator's voice is on.
  private recordedUrl(id: string): string | null {
    const voice = narratorVoice()
    const recorded = this.manifest?.voices[voice]?.clips[locale]?.[id]
    return this.soundToggle.checked && recorded ? clipUrl(voice, locale, id) : null
  }
}
