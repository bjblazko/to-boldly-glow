import type { Locale } from '../i18n/locale'

// A text written to be read, made fit to be spoken: the units and signs a voice would stumble over
// spelled out ("1,700 km/h" - "1,700 kilometres an hour"), in the narrators' British English or
// in German. The lessons' panels keep showing the written text.
const SPOKEN: Record<Locale, [RegExp, string][]> = {
  en: [
    [/\s*km\/h\b/g, ' kilometres an hour'],
    [/(\d)\s*km\b/g, '$1 kilometres'],
    [/(\d)\s*°/g, '$1 degrees'],
    [/(\d)\s*%/g, '$1 percent'],
    [/\bISO (\d+)-(\d)/g, 'I S O $1 part $2'],
    [/(\d)\s*AU\b/g, '$1 astronomical units'],
    [/(\d)\s*MeV\b/g, '$1 mega-electronvolts'],
    [/(\d)\s*m\b/g, '$1 metres'],
    [/(\d)\s*cm\b/g, '$1 centimetres'],
    [/(\d)\s*kg\b/g, '$1 kilograms'],
  ],
  de: [
    [/\s*km\/h\b/g, ' Kilometer pro Stunde'],
    [/(\d)\s*km\b/g, '$1 Kilometer'],
    [/(\d)\s*°/g, '$1 Grad'],
    [/(\d)\s*%/g, '$1 Prozent'],
    [/\bISO (\d+)-(\d)/g, 'I S O $1 Teil $2'],
    [/(\d)\s*AE\b/g, '$1 Astronomische Einheiten'],
    [/(\d)\s*MeV\b/g, '$1 Megaelektronenvolt'],
    [/(\d)-m-/g, '$1-Meter-'],
    [/(\d)\s*m\b/g, '$1 Meter'],
    [/(\d)\s*cm\b/g, '$1 Zentimeter'],
    [/(\d)\s*kg\b/g, '$1 Kilogramm'],
  ],
}

// More units, and names said in their own language: an English name in a German text is written as
// a German reader would say it in English ("Eagle" as "Igel", not "Ä-ga-le"). Read before the rules
// above (°C before °, m/s before m). Tried on the segments in REFINED_SEGMENTS first; once heard
// and found right, they go to every text (and its clips are spoken again).
const REFINED: Record<Locale, [RegExp, string][]> = {
  en: [
    [/(\d)\s*°C\b/g, '$1 degrees Celsius'],
    [/(\d)\s*km\/s\b/g, '$1 kilometres per second'],
    [/(\d)\s*m\/s\b/g, '$1 metres per second'],
    [/(\d)\s*m³/g, '$1 cubic metres'],
    [/(\d)\s*kN\b/g, '$1 kilonewtons'],
    [/(\d)\s*t\b/g, '$1 tonnes'],
  ],
  de: [
    [/(\d)\s*°C\b/g, '$1 Grad Celsius'],
    [/(\d)\s*km\/s\b/g, '$1 Kilometer pro Sekunde'],
    [/(\d)\s*m\/s\b/g, '$1 Meter pro Sekunde'],
    [/(\d)\s*m³/g, '$1 Kubikmeter'],
    [/(\d)\s*kN\b/g, '$1 Kilonewton'],
    [/(\d)\s*t\b/g, '$1 Tonnen'],
    [/(\d)([A-Z])\b/g, '$1 $2'],
    [/\bEagle(s?)\b/g, 'Igel$1'],
    [/\bColumbia(s?)\b/g, 'Kolambia$1'],
    [/\bCollins\b/g, 'Kollins'],
    [/\bMichael\b/g, 'Maikel'],
    [/\bNeil\b/g, 'Niel'],
    [/\bBuzz\b/g, 'Bass'],
    [/\bAldrin\b/g, 'Oldrin'],
    [/\bTranquility Base\b/g, 'Tränkwilliti Bäis'],
    [/\bUSS\b/g, 'U S S'],
    [/\bSaturn V\b/g, 'Saturn Faif'],
  ],
}

// The segments (by id prefix) the refined rules are tried on.
export const REFINED_SEGMENTS: readonly string[] = ['lessons/apollo11/']

export function spokenText(text: string, locale: Locale, refined = false): string {
  const rules = refined ? [...REFINED[locale], ...SPOKEN[locale]] : SPOKEN[locale]
  return rules.reduce((spoken, [pattern, replacement]) => spoken.replace(pattern, replacement), text)
}
