import { locale } from '../i18n/i18n'
import { AudioClipPlayer, type VoiceSignals } from '../narration/audioClipPlayer'
import { clipUrl, estimatedSeconds, type NarrationManifest } from '../narration/narrationManifest'
import { narratorVoice } from '../narration/narratorVoice'

// Reads out a mission tour's stations, one clip at a time, in the chosen narrator's voice - unless
// Settings have the narrator's voice off. A station without its clip yet is shown, not read; the
// tour then lingers as long as reading the text would take.
export class MissionNarration {
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

  // How long the station takes to read out, in seconds.
  seconds(clipId: string, text: string): number {
    return this.recorded(clipId)?.seconds ?? estimatedSeconds(text)
  }

  say(clipId: string): void {
    this.stop()
    const recorded = this.recorded(clipId)
    if (!this.soundToggle.checked || !recorded) return
    this.player.play({ text: '', seconds: recorded.seconds, url: clipUrl(narratorVoice(), locale, clipId) }, () => {})
  }

  // Fetches a station's clip ahead (the next one, while this one is read).
  prefetch(clipId: string): void {
    if (this.soundToggle.checked && this.recorded(clipId)) this.player.prefetch({ text: '', seconds: 0, url: clipUrl(narratorVoice(), locale, clipId) })
  }

  // Whether the clip being read is still loading: the tour waits for it.
  get isLoading(): boolean {
    return this.player.isLoading
  }

  stop(): void {
    this.player.stop()
  }

  private recorded(clipId: string): { seconds: number } | undefined {
    return this.manifest?.voices[narratorVoice()]?.clips[locale]?.[clipId]
  }
}
