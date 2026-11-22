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

// More units, read before the rules above (°C before °, m/s before m), in every text.
const UNITS: Record<Locale, [RegExp, string][]> = {
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
  ],
}

// Names said in their own language: an English name in a German text is written as a German
// reader would say it in English ("Eagle" as "Igel", not "Ä-ga-le"). Heard and found right on the
// Apollo 11 and Saturn V lessons (2026-11-22); a change here makes every clip it touches stale.
const NAMES: Record<Locale, [RegExp, string][]> = {
  // Roman numerals said as numbers (a voice may read them as letters): the Saturn V as "Saturn
  // Five", its stages S-IC, S-II, S-IVB as "S one C", "S two", "S four B".
  en: [
    [/\bSaturn V\b/g, 'Saturn Five'],
    [/\bSaturn IB\b/g, 'Saturn One B'],
    [/\bSaturn I\b/g, 'Saturn One'],
    [/\bS-IC\b/g, 'S one C'],
    [/\bS-II\b/g, 'S two'],
    [/\bS-IVB\b/g, 'S four B'],
    [/\bS-IV\b/g, 'S four'],
  ],
  de: [
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
    [/\bPurdue University\b/g, 'Pördju Juniwörsiti'],
    [/\bWest Point\b/g, 'Wäst Peunt'],
    [/\bMIT\b/g, 'Em Ai Ti'],
    [/\bNew Jersey\b/g, 'Nju Dschörsi'],
    [/\bMobile Quarantine Facility\b/g, 'Moubail Kwarantien Fasiliti'],
    [/\bLunar Receiving Laboratory\b/g, 'Luhner Risiewing Läboratori'],
    [/\bHouston\b/g, 'Hjuston'],
    [/\bTranslunar Injection\b/g, 'Tränsluhner Indschäkschn'],
    [/„You are go for TLI\.“/g, '„Ju ar gou for Ti Äl Ei.“'],
    [/\bTLI\b/g, 'Ti Äl Ei'],
    [/\bSaturn V\b/g, 'Saturn Fünf'],
    [/\bSaturn IB\b/g, 'Saturn Eins B'],
    [/\bSaturn I\b/g, 'Saturn Eins'],
    [/\bS-IC\b/g, 'S eins C'],
    [/\bS-II\b/g, 'S zwei'],
    [/\bS-IVB\b/g, 'S vier B'],
    [/\bS-IV\b/g, 'S vier'],
  ],
}

export function spokenText(text: string, locale: Locale): string {
  const rules = [...NAMES[locale], ...UNITS[locale], ...SPOKEN[locale]]
  return rules.reduce((spoken, [pattern, replacement]) => spoken.replace(pattern, replacement), text)
}
