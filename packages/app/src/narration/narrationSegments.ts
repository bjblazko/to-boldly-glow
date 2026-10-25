import { SUPPORTED_LOCALES, type Locale } from '../i18n/locale'
import { de } from './scripts/de'
import { en, type NarrationPart, type NarrationScript, type NarrationStop } from './scripts/en'

export const NARRATION_SCRIPTS: Record<Locale, NarrationScript> = { en, de }

// The language names Qwen3-TTS takes.
export const TTS_LANGUAGES: Record<Locale, string> = { en: 'English', de: 'German' }

export interface NarrationSegment {
  locale: Locale
  // `${stop}-${part}`: the clip's file name (narration/<locale>/<id>.mp3).
  id: string
  text: string
  language: string
}

export function segmentId(stop: NarrationStop, part: NarrationPart): string {
  return `${stop}-${part}`
}

// Every text the narrator speaks, in every language.
export function narrationSegments(): NarrationSegment[] {
  return SUPPORTED_LOCALES.flatMap((locale) =>
    Object.entries(NARRATION_SCRIPTS[locale]).flatMap(([stop, parts]) =>
      Object.entries(parts).map(([part, text]) => ({
        locale,
        id: segmentId(stop as NarrationStop, part as NarrationPart),
        text,
        language: TTS_LANGUAGES[locale],
      })),
    ),
  )
}
