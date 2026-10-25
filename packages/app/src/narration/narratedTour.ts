import { locale } from '../i18n/i18n'
import { AudioClipPlayer } from './audioClipPlayer'
import { NarrationBar } from './narrationBar'
import { clipUrl, estimatedSeconds, type NarrationManifest } from './narrationManifest'
import { NARRATION_SCRIPTS, segmentId } from './narrationSegments'
import { Narrator, type NarrationClip } from './narrator'
import { narratorVoice } from './narratorVoice'
import type { NarrationPart, NarrationStop } from './scripts/en'

// The narration for one run of the grand tour after another: a fresh narrator each time, sharing
// one audio element (once a click has let it play, it may go on playing) and the subtitle bar.
// Each clip is in the voice chosen when it starts, so a new choice takes over from the next one.
export class NarratedTour {
  private readonly player = new AudioClipPlayer()
  private readonly bar: NarrationBar
  private narrator: Narrator | null = null

  constructor(
    private readonly manifest: NarrationManifest | null,
    findElement: <T extends HTMLElement>(selector: string) => T,
  ) {
    this.bar = new NarrationBar(
      {
        bar: findElement('#narration-bar'),
        subtitle: findElement('#narration-subtitle'),
        mute: findElement('#narration-mute'),
        subtitlesToggle: findElement('#subtitles-toggle'),
      },
      this.player,
    )
  }

  // The narrator for a tour about to start: it paces the tour and hears where it is.
  begin(): Narrator {
    this.end()
    this.narrator = new Narrator((stop, part) => this.clip(stop, part), this.player, this.bar)
    this.bar.setActive(true)
    return this.narrator
  }

  end(): void {
    this.narrator?.stop()
    this.narrator = null
    this.bar.setActive(false)
  }

  private clip(stop: NarrationStop, part: NarrationPart): NarrationClip {
    const text = NARRATION_SCRIPTS[locale][stop][part]
    const id = segmentId(stop, part)
    const voice = narratorVoice()
    const recorded = this.manifest?.voices[voice]?.clips[locale]?.[id]
    return recorded ? { text, seconds: recorded.seconds, url: clipUrl(voice, locale, id) } : { text, seconds: estimatedSeconds(text), url: null }
  }
}
