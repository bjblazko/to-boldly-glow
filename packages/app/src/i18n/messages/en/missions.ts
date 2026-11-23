import { apollo11Tour } from './apollo11Tour'

// The mission tours' words: the controls, and each station's card - its title, what the narrator
// says (and the card shows), a photo's caption and its facts. Facts from NASA/JPL's Voyager mission
// pages; flyby distances from the probes' JPL Horizons flyby paths (from the planet's centre).

type Fact = { label: string; value: string }
export type StationText = { title: string; text: string; caption?: string; facts?: Fact[] }
// A tour's stations by id (see missions/voyagerMissions.ts).
type Stations = Record<string, StationText>

export const missions = {
  ui: {
    play: 'Play',
    pause: 'Pause',
    previous: 'Previous station',
    next: 'Next station',
    close: 'Leave the tour',
    timeline: 'Stations of the tour',
    distance: (au: string, lightHours: string) => `${au} AU from the Sun · signal ${lightHours} h`,
    flyby: 'Flyby at true scale · probe enlarged',
  },
  voyager1: {
    title: 'Voyager 1: Jupiter, Saturn - and first into interstellar space',
    meta: '2 flybys, the Pale Blue Dot, the heliopause · 8 stations · about 4 minutes',
    stations: {
      launch: {
        title: 'Launch',
        text:
          'Cape Canaveral, 5 September 1977. A Titan-Centaur rocket sends Voyager 1 on its way. It left two ' +
          'weeks after its twin but on a faster path - which is why it carries the number one.',
        caption: 'Voyager 1 lifts off, 5 September 1977',
      },
      overtake: {
        title: 'Overtaking',
        text:
          'In December 1977, in the asteroid belt, Voyager 1 overtakes Voyager 2. From here on it leads - all ' +
          'the way out of the solar system.',
      },
      jupiter: {
        title: 'Jupiter',
        text:
          'Closest approach on 5 March 1979, 349,000 kilometres from Jupiter’s centre. Voyager 1 discovers a ' +
          'thin ring and, on the moon Io, erupting volcanoes - the first active volcanoes ever seen beyond Earth.',
        caption: 'Volcanic plumes on Io’s rim, photographed by Voyager 1',
        facts: [
          { label: 'Closest', value: '349,000 km from the centre' },
          { label: 'Discovered', value: 'volcanoes on Io, Jupiter’s ring' },
        ],
      },
      saturn: {
        title: 'Saturn and Titan',
        text:
          'November 1980. Voyager 1 shows the rings to be thousands of ringlets and passes close by Titan, ' +
          'which hides under a thick haze of nitrogen - an atmosphere denser than Earth’s. The pass flings the ' +
          'probe up and out of the planets’ plane: no other planet lies ahead.',
        caption: 'Saturn with its moons Tethys and Dione, seen by Voyager 1',
        facts: [
          { label: 'Closest', value: '184,000 km from Saturn’s centre' },
          { label: 'Titan', value: 'air 1.5 times as dense as Earth’s' },
        ],
      },
      'pale-blue-dot': {
        title: 'The Pale Blue Dot',
        text:
          '14 February 1990, six billion kilometres out. Voyager 1 looks back and photographs the planets - and ' +
          'Earth, a speck smaller than a pixel. Then its cameras are switched off for good.',
        caption: 'The Pale Blue Dot, reprocessed in 2020',
      },
      'termination-shock': {
        title: 'The Termination Shock',
        text:
          'December 2004, 94 AU from the Sun. The solar wind, so far racing out at supersonic speed, suddenly ' +
          'slows down where it runs into the gas between the stars. Voyager 1 has crossed into the heliosheath, ' +
          'the bubble’s outer layer.',
      },
      heliopause: {
        title: 'Into Interstellar Space',
        text:
          '25 August 2012, 121.6 AU from the Sun. Within days the particles of the solar wind all but vanish and ' +
          'the magnetic field changes: Voyager 1 is the first human-made object in interstellar space.',
      },
      today: {
        title: 'Today',
        text:
          'Voyager 1 keeps going at about 17 kilometres a second. Its 23-watt transmitter still reaches the 70-metre ' +
          'dishes of the Deep Space Network; each message takes about a day to arrive.',
      },
    } as Stations,
  },
  voyager2: {
    title: 'Voyager 2: all four giant planets',
    meta: 'Jupiter, Saturn, Uranus and Neptune up close, then the heliopause · 8 stations · about 5 minutes',
    stations: {
      launch: {
        title: 'Launch',
        text:
          'Cape Canaveral, 20 August 1977. Voyager 2 is launched first, on a slower path that will take it past ' +
          'all four giant planets - a chance that comes only about every 175 years.',
        caption: 'Voyager 2 lifts off, 20 August 1977',
      },
      jupiter: {
        title: 'Jupiter',
        text:
          'Closest approach on 9 July 1979, 722,000 kilometres from Jupiter’s centre. Voyager 2 photographs ' +
          'Europa: a smooth shell of ice criss-crossed by cracks - a first hint of the ocean beneath it.',
        caption: 'Europa, photographed by Voyager 2',
        facts: [
          { label: 'Closest', value: '722,000 km from the centre' },
          { label: 'Europa', value: 'ice cracked like an eggshell' },
        ],
      },
      saturn: {
        title: 'Saturn',
        text:
          'August 1981. Voyager 2 passes Saturn at 161,000 kilometres and studies the rings in colour - differences ' +
          'that hint at different materials. Saturn’s gravity bends its path toward Uranus.',
        caption: 'Saturn’s rings in enhanced colour, from Voyager 2',
        facts: [{ label: 'Closest', value: '161,000 km from the centre' }],
      },
      uranus: {
        title: 'Uranus',
        text:
          'January 1986. The first and only visit to Uranus. Voyager 2 finds ten new moons and two new rings, and a ' +
          'magnetic field tipped far from the axis the planet spins on. The moon Miranda looks as if it had been ' +
          'broken apart and put back together.',
        caption: 'Miranda, photographed by Voyager 2',
        facts: [
          { label: 'Closest', value: '107,000 km from the centre' },
          { label: 'Discovered', value: '10 moons, 2 rings' },
        ],
      },
      neptune: {
        title: 'Neptune and Triton',
        text:
          'August 1989. Voyager 2 skims just 4,950 kilometres over Neptune’s cloud tops - the closest pass of the ' +
          'whole journey. It finds the Great Dark Spot, the fastest winds in the solar system, and geysers on the ' +
          'frozen moon Triton.',
        caption: 'Triton, Neptune’s largest moon, from Voyager 2',
        facts: [
          { label: 'Closest', value: '29,000 km from the centre' },
          { label: 'Winds', value: 'over 2,000 km/h' },
        ],
      },
      'termination-shock': {
        title: 'The Termination Shock',
        text:
          'August 2007, 84 AU from the Sun. Voyager 2 crosses the termination shock, where the solar wind slows ' +
          'down abruptly - several times within a few days, as the boundary moved back and forth over it.',
      },
      heliopause: {
        title: 'Into Interstellar Space',
        text:
          '5 November 2018, 119 AU from the Sun. Voyager 2 leaves the heliosphere. Unlike Voyager 1, whose plasma ' +
          'instrument failed in 1980, it could measure the solar wind itself come to a stop.',
      },
      today: {
        title: 'Today',
        text:
          'Voyager 2 travels south of the planets’ plane at about 15 kilometres a second. Only one dish on Earth, in ' +
          'Australia, can still send it commands.',
      },
    } as Stations,
  },
  apollo11: apollo11Tour,
}
