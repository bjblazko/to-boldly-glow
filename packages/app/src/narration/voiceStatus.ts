import type { VoiceSignals } from './audioClipPlayer'

// A clip that starts within this long is not worth a word; a slower one gets "Voice loading …".
const SHOW_AFTER_MS = 400

// Under the beta note: "Voice loading …" while any narrator's clip waits for its download, so a
// quiet start is not mistaken for no sound at all.
export class VoiceStatus {
  private readonly waiting = new Set<object>()
  private timer: ReturnType<typeof setTimeout> | undefined

  constructor(private readonly element: HTMLElement) {}

  loading(source: object, waiting: boolean): void {
    if (waiting) this.waiting.add(source)
    else this.waiting.delete(source)
    clearTimeout(this.timer)
    if (this.waiting.size === 0) this.element.hidden = true
    else if (this.element.hidden) this.timer = setTimeout(() => (this.element.hidden = false), SHOW_AFTER_MS)
  }
}

// The players' signals: the music steps back while the narrator speaks; the status shows a clip
// still loading.
export function voiceSignals(duck: (audible: boolean) => void, status: VoiceStatus): VoiceSignals {
  return { speaking: duck, loading: (source, waiting) => status.loading(source, waiting) }
}
