import type { Messages } from '../en'

const ROUTE_NOTE =
  'Die Route ist echt (JPL Horizons), aber im Kompakt-Maßstab gezeichnet: Entfernungen gestaucht, die ' +
  'Planeten um ein Vielfaches größer – deshalb scheinen die Sonden sie zu berühren; tatsächlich flogen ' +
  'sie in Zehntausenden Kilometern oder mehr vorbei. Die Sonde ist das 3D-Modell der NASA, die Fotos ' +
  'haben die Sonden selbst gemacht.'

export const voyagerScene: Messages['voyager'] = {
  parts: {
    bus: 'Elektronik und Treibstofftank',
    dish: 'Parabolantenne (3,7 m)',
    rtg: 'Strom: Plutonium-Batterien (RTGs)',
    science: 'Kameras und Spektrometer',
    magnetometer: 'Magnetometer (13-m-Ausleger)',
    record: 'Goldene Schallplatte',
  },
  features: {
    playing: 'So wird sie abgespielt',
    stylus: 'Von der Seite: außen beginnen',
    signal: 'So ist ein Bild gespeichert',
    firstImage: 'Testbild: ein Kreis',
    pulsarMap: 'Wo wir sind: 14 Pulsare',
    hydrogen: 'Die Uhr: Wasserstoff',
  },
  probes: { voyager1: 'Voyager 1', voyager2: 'Voyager 2' },
  facts: {
    launched: { label: 'Gestartet', value: 'Voyager 2: 20.8.1977 · Voyager 1: 5.9.1977' },
    mass: { label: 'Masse', value: 'je 722 kg' },
    dish: { label: 'Antenne', value: '3,7 m Durchmesser' },
    farthest: { label: 'Voyager 1', value: '172 AE von der Sonne (Nov. 2026)' },
    power: { label: 'Beim Start', value: 'etwa 470 W' },
    powerLoss: { label: 'Verlust', value: 'etwa 4 W pro Jahr' },
    halfLife: { label: 'Plutonium-238', value: 'Halbwertszeit 87,7 Jahre' },
    transmitter: { label: 'Sender', value: 'etwa 23 W' },
    dataRate: { label: 'Datenrate', value: '160 Bit pro Sekunde' },
    signalTime: { label: 'Signallaufzeit', value: 'etwa 24 Stunden zu Voyager 1 (2026)' },
    turn: { label: 'Eine Umdrehung', value: '3,6 s (16⅔ pro Minute)' },
    pulsars: { label: 'Pulsarkarte', value: '14 Pulsare' },
    uranium: { label: 'Uran-238', value: 'Halbwertszeit 4,5 Milliarden Jahre' },
  },
  heliopause: 'Heliopause',
  flybyPath: (probe) => `Bahn von ${probe}`,
  terminationShock: 'Terminationsschock',
  signal: {
    listen: '▶ Das Signal anhören',
    note: 'Unser eigenes Testbild, kodiert wie die Bilder auf der Platte – im Browser berechnet, nichts wird geladen.',
  },
  distance: (probe, au, billionKm, lightHours) => `${probe}: ${au} AE · ${billionKm} Mrd. km · Signal ${lightHours} h`,
  photoCredit: (credit) => `Foto: ${credit}`,
  externalLink: 'Öffnet eine externe Website in einem neuen Tab – du verlässt die App, und die Seite sieht deinen Besuch.',
  bundledNote: 'Gehört zur App – nichts wird aus dem Internet geladen.',
  charts: {
    gravityAssist: {
      title: 'Geschwindigkeit von Voyager 2 um die Sonne',
      speed: 'Geschwindigkeit',
      escape: 'Nötig, um das Sonnensystem zu verlassen',
      unit: 'km/s',
      source: 'Daten: NASA/JPL Horizons',
      flybys: { jupiter: 'Jupiter', saturn: 'Saturn', uranus: 'Uranus', neptune: 'Neptun' },
    },
    heliopause: {
      title: { voyager1: 'Voyager 1 verlässt die Heliosphäre, 2012', voyager2: 'Voyager 2 verlässt die Heliosphäre, 2018' },
      protons: 'Protonen aus der Blase (3–4,6 MeV, logarithmisch)',
      field: 'Magnetfeldstärke (nT)',
      source: 'Daten: NASA SPDF, Voyager-Teams CRS und MAG',
    },
  },
}

export const voyagerLesson: Messages['lessons']['voyager'] = {
  title: 'Voyager: die weiteste Reise',
  note: ROUTE_NOTE,
  chapters: {
    'two-probes': {
      title: 'Zwei Sonden, 1977',
      text:
        'Im Spätsommer 1977 startete die NASA zwei baugleiche Raumsonden: Voyager 2 am 20. August, Voyager 1 ' +
        'am 5. September. Jede wiegt so viel wie ein Kleinwagen – 722 kg – und trägt eine Parabolantenne ' +
        'von 3,7 Metern Durchmesser. Gebaut waren sie für fünf Jahre und einen Besuch bei Jupiter und ' +
        'Saturn. Fast ein halbes Jahrhundert später arbeiten beide noch, und Voyager 1 ist das ' +
        'entfernteste Objekt, das Menschen je gebaut haben.',
    },
    'on-board': {
      title: 'Was an Bord ist',
      text:
        'Die große Antenne zeigt immer zurück zur Erde: Über sie schickt Voyager Bilder und Messwerte nach ' +
        'Hause. Der Ausleger auf der einen Seite trägt die Kameras und die anderen Instrumente, die Planeten ' +
        'beobachten. Auf dem Ausleger gegenüber machen drei Plutonium-Batterien Strom aus Wärme – dort ' +
        'draußen ist das Sonnenlicht viel zu schwach für Solarzellen. Der lange, dünne Ausleger hält ein ' +
        'Magnetometer weit weg von der eigenen Elektronik, damit es schwache Magnetfelder messen kann. Und ' +
        'außen am Rumpf: die Goldene Schallplatte.',
    },
    'golden-record': {
      title: 'Die Goldene Schallplatte',
      text:
        'Jede Voyager trägt eine vergoldete Kupferplatte von 30 cm Durchmesser – eine Botschaft für alle, die ' +
        'sie vielleicht in Millionen Jahren finden. Ein Team um Carl Sagan hat darauf 115 Bilder gespeichert, ' +
        'Grüße in 55 Sprachen, Geräusche der Erde – Wind, Regen, Brandung, Vögel, ein Herzschlag, ein Kuss – ' +
        'und 90 Minuten Musik aus vielen Kulturen, von Bach und Beethoven bis Chuck Berry, peruanischen ' +
        'Panflöten und einem Nachtgesang der Navajo. Bilder und Musik gehören ihren Urhebern, deshalb sind ' +
        'sie nicht Teil dieser App; die NASA zeigt sie auf ihrer Website.',
    },
    instructions: {
      title: 'Eine Anleitung, uns zu finden',
      text:
        'Die Platte reist in einer Hülle aus Aluminium, in die eine Anleitung graviert ist – ohne Worte, in ' +
        'Bildern und Binärzahlen. Oben links: wie man sie abspielt, mit der mitgelieferten Nadel – und ' +
        'darunter, von der Seite, dass man außen beginnt. Oben rechts: wie die Bilder als Ton gespeichert ' +
        'sind, Zeile für Zeile, und ein erstes Testbild, ein Kreis, zur Kontrolle. Unten links: eine Karte ' +
        'von 14 Pulsaren – Sternen, die in sehr gleichmäßigem Takt blinken –, die zeigt, wo die Sonne in ' +
        'unserer Galaxis steht. Unten rechts: das Wasserstoffatom, das häufigste Atom im Universum; die ' +
        'Zeit, in der es zwischen zwei Zuständen wechselt, ist die Einheit aller anderen Zahlen auf der Hülle.',
    },
    alignment: {
      title: 'Eine seltene Konstellation',
      text:
        'Ende der 1970er-Jahre standen Jupiter, Saturn, Uranus und Neptun auf einer Seite der Sonne – eine ' +
        'Anordnung, die nur etwa alle 175 Jahre vorkommt. Eine Sonde konnte von einem Riesenplaneten zum ' +
        'nächsten schwingen und mit der Schwerkraft jedes Planeten schneller werden und Kurs auf den ' +
        'nächsten nehmen, ohne den Treibstoff, den sie sonst bräuchte. Voyager 2 startete zuerst, auf einer ' +
        'langsameren Bahn; Voyager 1 folgte zwei Wochen später auf einer schnelleren und überholte sie im ' +
        'Dezember 1977 im Asteroidengürtel.',
    },
    jupiter: {
      title: 'Jupiter, 1979',
      text:
        'Voyager 1 flog am 5. März 1979 an Jupiter vorbei, Voyager 2 am 9. Juli. Sie filmten, wie sich der ' +
        'Große Rote Fleck dreht – ein Sturm größer als die Erde –, entdeckten einen dünnen Ring um den ' +
        'Planeten und aktive Vulkane auf seinem Mond Io: die ersten, die man je jenseits der Erde gesehen hat.',
    },
    saturn: {
      title: 'Saturn, 1980 und 1981',
      text:
        'Voyager 1 erreichte Saturn im November 1980, Voyager 2 im August 1981. Sie zeigten, dass die Ringe ' +
        'aus Tausenden schmaler Einzelringe bestehen. Voyager 1 flog dann dicht an Titan vorbei, Saturns ' +
        'großem Mond im Dunst – ein Umweg, der ihre Bahn nach oben aus der Ebene der Planeten lenkte, sodass ' +
        'sie keinen weiteren Planeten besuchen konnte. Voyager 2 flog weiter.',
    },
    'ice-giants': {
      title: 'Uranus und Neptun',
      text:
        'Voyager 2 ist bis heute die einzige Sonde, die Uranus (Januar 1986) und Neptun (August 1989) ' +
        'besucht hat. Bei Neptun, 4,5 Milliarden km von der Sonne entfernt, fand sie den Großen Dunklen ' +
        'Fleck, die schnellsten Winde im Sonnensystem – über 2.000 km/h – und Geysire auf dem Mond Triton. ' +
        'Ihre Signale brauchten mehr als vier Stunden bis zur Erde.',
    },
    'pale-blue-dot': {
      title: 'Der blassblaue Punkt',
      text:
        'Am 14. Februar 1990, sechs Milliarden Kilometer von zu Hause, drehte Voyager 1 ihre Kameras zurück ' +
        'und machte das erste Porträt des Sonnensystems von außen. Darauf ist die Erde kleiner als ein ' +
        'Pixel: ein blassblauer Punkt in einem Streifen gestreuten Sonnenlichts. Minuten später wurden die ' +
        'Kameras für immer abgeschaltet, um Strom für die lange Reise zu sparen.',
    },
    interstellar: {
      title: 'Hinaus in den interstellaren Raum',
      text:
        'Die Sonne bläst einen Wind aus geladenen Teilchen, der eine Blase um das Sonnensystem aufbläst: die ' +
        'Heliosphäre. Am 25. August 2012 verließ Voyager 1 sie, 121,6 AE von der Sonne entfernt – als ' +
        'erstes von Menschen gebautes Objekt im interstellaren Raum. Voyager 2 folgte am 5. November 2018. ' +
        'Heute ist Voyager 1 mehr als 170-mal so weit von der Sonne entfernt wie die Erde, und ihr Signal ' +
        'braucht etwa einen Tag zu uns. Wie Voyager funktioniert und was sie gemessen hat: die Lektion ' +
        '„Voyager im Detail“.',
    },
  },
  captions: {
    launch: 'Voyager 1 startet auf einer Titan-Centaur-Rakete, 5. September 1977',
    jupiter: 'Jupiter mit dem Großen Roten Fleck, fotografiert von Voyager 1',
    saturn: 'Saturn mit seinen Monden Tethys, Enceladus und Mimas, gesehen von Voyager',
    neptune: 'Neptun, aufgenommen von Voyager 2 vier Tage vor dem Vorbeiflug',
    triton: 'Triton, Neptuns größter Mond, aufgenommen von Voyager 2',
    paleBlueDot: 'Der blassblaue Punkt, 2020 neu bearbeitet: Die Erde ist das Pünktchen im rechten Lichtstreifen',
  },
  links: {
    recordContents: 'Bilder, Klänge und Musik der Goldenen Schallplatte bei der NASA (science.nasa.gov, Englisch)',
  },
}
