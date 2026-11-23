import { apollo11Tour } from './apollo11Tour'

import type { Messages } from '../en'

export const missions: Messages['missions'] = {
  ui: {
    shuttle: 'Jog',
    shuttleTitle: 'Jog und Shuttle (J, K, L, Pfeiltasten)',
    overview: 'Die ganze Tour',
    spring: 'Shuttle: schieben, um zurück oder vor zu laufen, je weiter, desto schneller',
    jog: 'Jog-Rad: drehen für einzelne Bilder, mit Umschalt für Sekunden',
    play: 'Abspielen',
    pause: 'Anhalten',
    previous: 'Vorige Station',
    next: 'Nächste Station',
    close: 'Tour verlassen',
    timeline: 'Stationen der Tour',
    distance: (au, lightHours) => `${au} AE von der Sonne · Signal ${lightHours} h`,
    flyby: 'Vorbeiflug in echtem Maßstab · Sonde vergrößert',
  },
  voyager1: {
    title: 'Voyager 1: Jupiter, Saturn – und als Erste in den interstellaren Raum',
    meta: '2 Vorbeiflüge, der blassblaue Punkt, die Heliopause · 8 Stationen · etwa 4 Minuten',
    stations: {
      launch: {
        title: 'Start',
        text:
          'Cape Canaveral, 5. September 1977. Eine Titan-Centaur-Rakete bringt Voyager 1 auf den Weg. Sie ' +
          'startete zwei Wochen nach ihrer Zwillingssonde, aber auf einer schnelleren Bahn – deshalb trägt sie ' +
          'die Nummer eins.',
        caption: 'Voyager 1 hebt ab, 5. September 1977',
      },
      overtake: {
        title: 'Überholt',
        text:
          'Im Dezember 1977, im Asteroidengürtel, überholt Voyager 1 ihre Zwillingssonde. Von hier an liegt sie ' +
          'vorn – bis hinaus aus dem Sonnensystem.',
      },
      jupiter: {
        title: 'Jupiter',
        text:
          'Größte Annäherung am 5. März 1979, 349.000 Kilometer vom Mittelpunkt des Jupiters. Voyager 1 entdeckt ' +
          'einen dünnen Ring und auf dem Mond Io ausbrechende Vulkane – die ersten aktiven Vulkane, die man je ' +
          'jenseits der Erde gesehen hat.',
        caption: 'Vulkanfahnen am Rand von Io, fotografiert von Voyager 1',
        facts: [
          { label: 'Am nächsten', value: '349.000 km vom Mittelpunkt' },
          { label: 'Entdeckt', value: 'Vulkane auf Io, Jupiters Ring' },
        ],
      },
      saturn: {
        title: 'Saturn und Titan',
        text:
          'November 1980. Voyager 1 zeigt, dass die Ringe aus Tausenden Einzelringen bestehen, und fliegt dicht an ' +
          'Titan vorbei, der sich unter einem dicken Dunst aus Stickstoff versteckt – eine Atmosphäre, dichter als ' +
          'die der Erde. Der Vorbeiflug schleudert die Sonde nach oben aus der Ebene der Planeten: Vor ihr liegt ' +
          'kein Planet mehr.',
        caption: 'Saturn mit seinen Monden Tethys und Dione, gesehen von Voyager 1',
        facts: [
          { label: 'Am nächsten', value: '184.000 km vom Saturn-Mittelpunkt' },
          { label: 'Titan', value: 'Luft 1,5-mal so dicht wie auf der Erde' },
        ],
      },
      'pale-blue-dot': {
        title: 'Der blassblaue Punkt',
        text:
          '14. Februar 1990, sechs Milliarden Kilometer draußen. Voyager 1 blickt zurück und fotografiert die ' +
          'Planeten – und die Erde, ein Pünktchen kleiner als ein Pixel. Dann werden ihre Kameras für immer ' +
          'abgeschaltet.',
        caption: 'Der blassblaue Punkt, 2020 neu bearbeitet',
      },
      'termination-shock': {
        title: 'Der Terminationsschock',
        text:
          'Dezember 2004, 94 AE von der Sonne. Der Sonnenwind, bisher mit Überschall unterwegs, wird plötzlich ' +
          'langsamer, wo er auf das Gas zwischen den Sternen trifft. Voyager 1 ist in der Helioshülle angekommen, ' +
          'der äußeren Schicht der Blase.',
      },
      heliopause: {
        title: 'Hinaus in den interstellaren Raum',
        text:
          '25. August 2012, 121,6 AE von der Sonne. Innerhalb weniger Tage verschwinden die Teilchen des ' +
          'Sonnenwinds fast völlig, und das Magnetfeld ändert sich: Voyager 1 ist das erste von Menschen gebaute ' +
          'Objekt im interstellaren Raum.',
      },
      today: {
        title: 'Heute',
        text:
          'Voyager 1 fliegt mit etwa 17 Kilometern pro Sekunde weiter. Ihr 23-Watt-Sender erreicht noch immer die ' +
          '70-Meter-Antennen des Deep Space Network; jede Nachricht braucht etwa einen Tag.',
      },
    },
  },
  voyager2: {
    title: 'Voyager 2: alle vier Riesenplaneten',
    meta: 'Jupiter, Saturn, Uranus und Neptun aus der Nähe, dann die Heliopause · 8 Stationen · etwa 5 Minuten',
    stations: {
      launch: {
        title: 'Start',
        text:
          'Cape Canaveral, 20. August 1977. Voyager 2 startet als erste, auf einer langsameren Bahn, die sie an ' +
          'allen vier Riesenplaneten vorbeiführt – eine Gelegenheit, die es nur etwa alle 175 Jahre gibt.',
        caption: 'Voyager 2 hebt ab, 20. August 1977',
      },
      jupiter: {
        title: 'Jupiter',
        text:
          'Größte Annäherung am 9. Juli 1979, 722.000 Kilometer vom Mittelpunkt des Jupiters. Voyager 2 ' +
          'fotografiert Europa: eine glatte Eisschale, kreuz und quer von Rissen durchzogen – ein erster Hinweis ' +
          'auf den Ozean darunter.',
        caption: 'Europa, fotografiert von Voyager 2',
        facts: [
          { label: 'Am nächsten', value: '722.000 km vom Mittelpunkt' },
          { label: 'Europa', value: 'Eis, gesprungen wie eine Eierschale' },
        ],
      },
      saturn: {
        title: 'Saturn',
        text:
          'August 1981. Voyager 2 fliegt in 161.000 Kilometern an Saturn vorbei und untersucht die Ringe in Farbe – ' +
          'Unterschiede, die auf verschiedene Stoffe hindeuten. Saturns Schwerkraft lenkt ihre Bahn in Richtung Uranus.',
        caption: 'Saturns Ringe in verstärkten Farben, von Voyager 2',
        facts: [{ label: 'Am nächsten', value: '161.000 km vom Mittelpunkt' }],
      },
      uranus: {
        title: 'Uranus',
        text:
          'Januar 1986. Der erste und einzige Besuch bei Uranus. Voyager 2 findet zehn neue Monde und zwei neue ' +
          'Ringe, dazu ein Magnetfeld, das weit gegen die Drehachse des Planeten gekippt ist. Der Mond Miranda ' +
          'sieht aus, als wäre er zerbrochen und wieder zusammengesetzt worden.',
        caption: 'Miranda, fotografiert von Voyager 2',
        facts: [
          { label: 'Am nächsten', value: '107.000 km vom Mittelpunkt' },
          { label: 'Entdeckt', value: '10 Monde, 2 Ringe' },
        ],
      },
      neptune: {
        title: 'Neptun und Triton',
        text:
          'August 1989. Voyager 2 streift nur 4.950 Kilometer über Neptuns Wolken – der nächste Vorbeiflug der ' +
          'ganzen Reise. Sie findet den Großen Dunklen Fleck, die schnellsten Winde im Sonnensystem und Geysire ' +
          'auf dem gefrorenen Mond Triton.',
        caption: 'Triton, Neptuns größter Mond, von Voyager 2',
        facts: [
          { label: 'Am nächsten', value: '29.000 km vom Mittelpunkt' },
          { label: 'Wind', value: 'über 2.000 km/h' },
        ],
      },
      'termination-shock': {
        title: 'Der Terminationsschock',
        text:
          'August 2007, 84 AE von der Sonne. Voyager 2 durchquert den Terminationsschock, wo der Sonnenwind ' +
          'schlagartig langsamer wird – mehrmals innerhalb weniger Tage, weil die Grenze über ihr hin und her ' +
          'schwankte.',
      },
      heliopause: {
        title: 'Hinaus in den interstellaren Raum',
        text:
          '5. November 2018, 119 AE von der Sonne. Voyager 2 verlässt die Heliosphäre. Anders als bei Voyager 1, ' +
          'deren Plasma-Instrument 1980 ausfiel, konnte sie direkt messen, wie der Sonnenwind zum Stillstand kommt.',
      },
      today: {
        title: 'Heute',
        text:
          'Voyager 2 fliegt südlich der Planetenebene mit etwa 15 Kilometern pro Sekunde. Nur noch eine Antenne auf ' +
          'der Erde, in Australien, kann ihr Befehle schicken.',
      },
    },
  },
  apollo11: apollo11Tour,
}
