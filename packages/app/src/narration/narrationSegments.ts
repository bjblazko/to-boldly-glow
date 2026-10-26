import { messagesFor } from '../i18n/i18n'
import { SUPPORTED_LOCALES, type Locale } from '../i18n/locale'
import { orderedPlanetIds, PLANET_ORDERS } from '../learn/sizes/planetOrders'
import { de } from './scripts/de'
import { en, type NarrationPart, type NarrationScript, type NarrationStop } from './scripts/en'
import { ORDER_LINES } from './scripts/orders'
import { spokenText } from './spokenText'

export const NARRATION_SCRIPTS: Record<Locale, NarrationScript> = { en, de }

// The language names Qwen3-TTS takes.
export const TTS_LANGUAGES: Record<Locale, string> = { en: 'English', de: 'German' }

// The lessons whose chapters the narrator reads out, as the catalog keeps their texts. The planets
// lesson's planet chapters take the tour's words for each planet instead (see lessonClipId).
const READ_LESSONS = ['seasons', 'moonPhases', 'solarEclipse'] as const

export interface NarrationSegment {
  locale: Locale
  // The clip's file name (narration/<voice>/<locale>/<id>.webm): `${stop}-${part}` for the tour,
  // `lesson-${lesson}-${chapter}` for a lesson's chapter, `order-${order}` for a planet order.
  id: string
  text: string
  language: string
}

export function segmentId(stop: NarrationStop, part: NarrationPart): string {
  return `${stop}-${part}`
}

// The clip for a lesson's chapter: a planet's is the tour's, said while circling it.
export function lessonClipId(lessonId: string, chapterId: string, focusPlanetId?: string): string {
  return focusPlanetId ? segmentId(focusPlanetId as NarrationStop, 'orbit') : `lesson-${lessonId}-${chapterId}`
}

export function orderClipId(orderId: string): string {
  return `order-${orderId}`
}

// Every text the narrator speaks, in every language: the tour, the lessons, the planet orders.
export function narrationSegments(): NarrationSegment[] {
  return SUPPORTED_LOCALES.flatMap((locale) => {
    const segment = (id: string, text: string): NarrationSegment => ({ locale, id, text, language: TTS_LANGUAGES[locale] })
    const texts = [...tourTexts(locale), ...lessonTexts(locale), ...orderTexts(locale)]
    return texts.map(([id, text]) => segment(id, text))
  })
}

function tourTexts(locale: Locale): [string, string][] {
  return Object.entries(NARRATION_SCRIPTS[locale]).flatMap(([stop, parts]) =>
    Object.entries(parts).map(([part, text]): [string, string] => [segmentId(stop as NarrationStop, part as NarrationPart), text]),
  )
}

// Each chapter's title, then its text, as its panel shows them.
function lessonTexts(locale: Locale): [string, string][] {
  const { lessons } = messagesFor(locale)
  const chapters = READ_LESSONS.flatMap((lessonId) =>
    Object.entries(lessons[lessonId].chapters).map(([chapterId, chapter]): [string, { title: string; text: string }] => [lessonClipId(lessonId, chapterId), chapter]),
  )
  chapters.push([lessonClipId('planetSizes', 'lineup'), lessons.planetSizes.lineup])
  return chapters.map(([id, { title, text }]) => [id, spokenText(`${title}${/[.?!]$/.test(title) ? '' : '.'} ${text}`, locale)])
}

function orderTexts(locale: Locale): [string, string][] {
  const names = messagesFor(locale).scene.bodies
  return PLANET_ORDERS.map((order) => [orderClipId(order.id), ORDER_LINES[locale][order.id](orderedPlanetIds(order).map((id) => names[id]))])
}
