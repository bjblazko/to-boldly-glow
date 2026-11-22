import { describe, expect, it } from 'vitest'
import { spokenText } from '../src/narration/spokenText'

describe('texts made fit to be spoken', () => {
  it('spells out units a voice would read as letters', () => {
    expect(spokenText('weighed 2,938 t at 27 °C, 667 kN, 6.4 m/s, 10.8 km/s, 4.5 m³', 'en')).toBe(
      'weighed 2,938 tonnes at 27 degrees Celsius, 667 kilonewtons, 6.4 metres per second, 10.8 kilometres per second, 4.5 cubic metres',
    )
    expect(spokenText('wog 2.938 t bei 27 °C, 667 kN, 6,4 m/s, 10,8 km/s, 4,5 m³', 'de')).toBe(
      'wog 2.938 Tonnen bei 27 Grad Celsius, 667 Kilonewton, 6,4 Meter pro Sekunde, 10,8 Kilometer pro Sekunde, 4,5 Kubikmeter',
    )
  })

  it('writes English names in German as a German voice would say them in English', () => {
    expect(spokenText('Eagle koppelte von Columbia ab; Neil Armstrong, Buzz Aldrin und Michael Collins. Tranquility Base, USS Hornet, Saturn V, Startkomplex 39A.', 'de')).toBe(
      'Igel koppelte von Kolambia ab; Niel Armstrong, Bass Oldrin und Maikel Kollins. Tränkwilliti Bäis, U S S Hornet, Saturn Fünf, Startkomplex 39 A.',
    )
  })

  it('keeps a German genitive on an English name', () => {
    expect(spokenText('Columbias Triebwerk, Eagles Beine', 'de')).toBe('Kolambias Triebwerk, Igels Beine')
  })

  it('leaves English names to the English voice', () => {
    expect(spokenText('Eagle undocked from Columbia.', 'en')).toBe('Eagle undocked from Columbia.')
    expect(spokenText('the Saturn V lifted', 'en')).toBe('the Saturn Five lifted')
  })

  it('says the Saturns and their stages with numbers, in the text’s language', () => {
    expect(spokenText('S-IC, S-II and S-IVB; an improved S-IV from the Saturn I and Saturn IB, under the Saturn V.', 'en')).toBe(
      'S one C, S two and S four B; an improved S four from the Saturn One and Saturn One B, under the Saturn Five.',
    )
    expect(spokenText('S-IC, S-II und S-IVB; eine verbesserte S-IV der Saturn I.', 'de')).toBe('S eins C, S zwei und S vier B; eine verbesserte S vier der Saturn Eins.')
  })

  it('says the names and the units in every text, not only in the lessons they were tried on', () => {
    expect(spokenText('Eagle, 13 t', 'de')).toBe('Igel, 13 Tonnen')
  })

  it('spells TLI in German as an English speaker says it, in the quote too', () => {
    expect(spokenText('kurz TLI. „You are go for TLI.“', 'de')).toBe('kurz Ti Äl Ei. „Ju ar gou for Ti Äl Ei.“')
  })

  it('says the crew’s schools and the quarantine’s English names as in English', () => {
    expect(spokenText('Purdue University, West Point, das MIT, aus New Jersey, die Mobile Quarantine Facility, das Lunar Receiving Laboratory in Houston', 'de')).toBe(
      'Pördju Juniwörsiti, Wäst Peunt, das Em Ai Ti, aus Nju Dschörsi, die Moubail Kwarantien Fasiliti, das Luhner Risiewing Läboratori in Hjuston',
    )
  })

  it('says the launch tower’s English names as in English', () => {
    expect(spokenText('der White Room, der Pad Leader, im Vehicle Assembly Building', 'de')).toBe('der Weit Ruhm, der Päd Lieder, im Wiekl Essembli Bilding')
  })
})
