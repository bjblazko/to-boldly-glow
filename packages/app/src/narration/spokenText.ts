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

export function spokenText(text: string, locale: Locale): string {
  return SPOKEN[locale].reduce((spoken, [pattern, replacement]) => spoken.replace(pattern, replacement), text)
}
