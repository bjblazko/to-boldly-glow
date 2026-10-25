import type { Messages } from '../en'

export const planets: Messages['planets'] = {
  intros: {
    mercury:
      'Der kleinste Planet und der sonnennächste. Fast ohne Luft, die die Wärme halten könnte, sind seine Tage ' +
      'glühend heiß und seine Nächte eisig.',
    venus:
      'Fast so groß wie die Erde, aber ihre dichte Luft hält so viel Wärme fest, dass sie der heißeste Planet ' +
      'ist – heißer sogar als Merkur, der näher an der Sonne liegt.',
    earth: 'Unser Zuhause und der größte der vier Gesteinsplaneten – die einzige bekannte Welt mit Ozeanen an der Oberfläche, und mit Leben.',
    mars: 'Der Rote Planet, etwa halb so breit wie die Erde: Rostiger Staub färbt ihn rot, und er trägt den höchsten Vulkan im Sonnensystem.',
    jupiter: 'Der größte Planet, mehr als doppelt so schwer wie alle anderen zusammen. Ein Gasriese: Er hat keinen festen Boden, auf dem man stehen könnte.',
    saturn: 'Der Ringplanet. Seine Ringe sind rund 280.000 km breit, aber meist nur etwa 10 Meter dick – und Saturn selbst ist so leicht, dass er auf Wasser schwimmen würde.',
    uranus: 'Ein Eisriese, der auf der Seite liegend um die Sonne rollt: Seine Achse ist um 98° gekippt, deshalb hat jeder Pol 42 Jahre Tag und dann 42 Jahre Nacht.',
    neptune: 'Der fernste Planet: ein Eisriese mit den schnellsten Winden im Sonnensystem, bis zu 2.000 km/h. Sonnenlicht braucht über vier Stunden bis dorthin.',
  },
  atmospheres: {
    mercury: 'Nein – nur Spuren',
    venus: 'Ja, sehr dicht: CO₂',
    earth: 'Ja: Stickstoff, Sauerstoff',
    mars: 'Ja, dünn: CO₂',
    jupiter: 'Ja: Wasserstoff, Helium',
    saturn: 'Ja: Wasserstoff, Helium',
    uranus: 'Ja: Wasserstoff, Helium, Methan',
    neptune: 'Ja: Wasserstoff, Helium, Methan',
  },
  types: { rocky: 'Gesteinsplanet', gasGiant: 'Gasriese', iceGiant: 'Eisriese' },
  facts: {
    diameter: 'Durchmesser',
    circumference: 'Umfang',
    mass: 'Masse',
    type: 'Art',
    atmosphere: 'Atmosphäre',
    cloudTops: 'Wolkenobergrenze',
    temperature: 'Temperatur',
    fromSun: 'Abstand zur Sonne',
    spin: 'Eine Drehung',
    year: 'Jahr',
  },
  units: {
    dayAndNight: (temperature) => `${temperature}, Tag und Nacht`,
    range: (from, to) => `${from} bis ${to}`,
    billionKm: (value) => `${value} Mrd. km`,
    millionKm: (value) => `${value} Mio. km`,
    timesEarth: (value) => `${value} × Erde`,
    hours: (value) => `${value} Stunden`,
    days: (value) => `${value} Tage`,
    years: (value) => `${value} Jahre`,
    backwards: (time) => `${time}, rückwärts`,
  },
  orders: {
    distance: { name: 'Abstand zur Sonne', hint: '' },
    size: { name: 'Größe', hint: '' },
    mass: { name: 'Masse', hint: '' },
    type: { name: 'Gestein, Gas oder Eis', hint: '' },
    speed: { name: 'Tempo um die Sonne', hint: 'Je näher an der Sonne, desto schneller fliegt ein Planet.' },
    day: { name: 'Länge eines Tages', hint: 'Von einem Sonnenaufgang zum nächsten – nicht dasselbe wie eine Drehung.' },
    year: { name: 'Länge eines Jahres', hint: '' },
    temperature: { name: 'Temperatur', hint: 'Im Mittel. Bei den Riesen: an der Wolkenobergrenze.' },
    density: { name: 'Dichte', hint: 'Wasser hat 1 g/cm³ – Saturn würde darin schwimmen.' },
    gravity: { name: 'Schwerkraft', hint: 'Wie schwer du dich fühlen würdest. Bei den Riesen: an der Wolkenobergrenze.' },
    tilt: { name: 'Achsneigung', hint: 'Über 90° dreht sich ein Planet rückwärts.' },
  },
}
