import type { OriginalAudioView } from './lessonNarration'

type Find = <T extends HTMLElement>(selector: string) => T

// Under the scene while a recording from the time plays in a lesson: its words, and who says them.
// Shown whatever the subtitles setting: the recordings are in English.
export class OriginalAudioCaption implements OriginalAudioView {
  private readonly root: HTMLElement
  private readonly words: HTMLElement
  private readonly speaker: HTMLElement

  constructor(find: Find) {
    this.root = find('#original-audio')
    this.words = find('#original-audio-words')
    this.speaker = find('#original-audio-speaker')
  }

  show(words: string | null, speaker: string | null): void {
    this.root.hidden = speaker === null
    if (this.words.textContent !== (words ?? '')) this.words.textContent = words ?? ''
    this.words.classList.toggle('is-empty', !words)
    this.speaker.textContent = speaker ?? ''
  }
}
