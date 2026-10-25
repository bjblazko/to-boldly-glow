import type { Locale } from '../i18n/locale'
import type { NarratorVoice } from './narratorVoice'

// packages/app/public/narration/manifest.json, written by the narration synthesis
// (packages/data-pipeline/narration/synthesize.py): which model spoke the clips and how they are
// encoded, and per voice the reference recording it cloned in each language and each clip's text
// hash and length.
export interface NarrationManifest {
  model: string
  encoding: string
  voices: Partial<Record<NarratorVoice, VoiceClips>>
}

export interface VoiceClips {
  references: Partial<Record<Locale, string>>
  clips: Partial<Record<Locale, Record<string, { hash: string; seconds: number }>>>
}

export const MANIFEST_URL = 'narration/manifest.json'

// Each clip comes as Opus (in WebM: half the size of the MP3, and better for speech) and as MP3,
// for browsers without Opus.
let audioExtension: 'webm' | 'mp3' | undefined

function playableExtension(): 'webm' | 'mp3' {
  audioExtension ??= typeof Audio !== 'undefined' && new Audio().canPlayType('audio/webm; codecs="opus"') !== '' ? 'webm' : 'mp3'
  return audioExtension
}

export function clipUrl(voice: NarratorVoice, locale: Locale, segmentId: string): string {
  return `narration/${voice}/${locale}/${segmentId}.${playableExtension()}`
}

// Without a manifest (or a clip in it), the tour is narrated by subtitles alone, at about this pace.
const WORDS_PER_SECOND = 2.3

export function estimatedSeconds(text: string): number {
  return text.split(/\s+/).length / WORDS_PER_SECOND
}

export async function loadNarrationManifest(): Promise<NarrationManifest | null> {
  try {
    const response = await fetch(MANIFEST_URL)
    return response.ok ? ((await response.json()) as NarrationManifest) : null
  } catch {
    return null
  }
}
