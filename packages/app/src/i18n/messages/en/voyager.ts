// The Voyager lessons' words: the lesson for everyone, the labels in its scenes, and the words the
// panel uses for photos, charts and links. Facts from NASA/JPL's Voyager mission pages and fact
// sheets; dates and distances along the route from the probes' JPL Horizons trajectories.

const ROUTE_NOTE =
  'The route is real (JPL Horizons), but drawn at Compact scale: distances are compressed and the ' +
  'planets drawn many times larger, so the probes seem to touch them - they passed at tens of ' +
  'thousands of kilometres or more. The spacecraft is NASA’s own 3D model; the photos are the probes’ own.'

export const voyagerScene = {
  parts: {
    bus: 'Electronics and fuel tank',
    dish: 'High-gain antenna (3.7 m)',
    rtg: 'Power: plutonium batteries (RTGs)',
    science: 'Cameras and spectrometers',
    magnetometer: 'Magnetometer (13 m boom)',
    record: 'Golden Record',
  },
  features: {
    playing: 'How to play it',
    stylus: 'From the side: start at the edge',
    signal: 'How a picture is stored',
    firstImage: 'Test picture: a circle',
    pulsarMap: 'Where we are: 14 pulsars',
    hydrogen: 'The clock: hydrogen',
  },
  probes: { voyager1: 'Voyager 1', voyager2: 'Voyager 2' },
  // The chapters' facts: label, value.
  facts: {
    launched: { label: 'Launched', value: 'Voyager 2: 20 Aug 1977 · Voyager 1: 5 Sep 1977' },
    mass: { label: 'Mass', value: '722 kg each' },
    dish: { label: 'Dish', value: '3.7 m across' },
    farthest: { label: 'Voyager 1', value: '172 AU from the Sun (Nov 2026)' },
    power: { label: 'At launch', value: 'about 470 W' },
    powerLoss: { label: 'Loss', value: 'about 4 W a year' },
    halfLife: { label: 'Plutonium-238', value: 'half-life 87.7 years' },
    transmitter: { label: 'Transmitter', value: 'about 23 W' },
    dataRate: { label: 'Data rate', value: '160 bits per second' },
    signalTime: { label: 'Signal time', value: 'about 24 hours to Voyager 1 (2026)' },
    turn: { label: 'One turn', value: '3.6 s (16⅔ per minute)' },
    pulsars: { label: 'Pulsar map', value: '14 pulsars' },
    uranium: { label: 'Uranium-238', value: 'half-life 4.5 billion years' },
  },
  heliopause: 'Heliopause',
  flybyPath: (probe: string) => `Path of ${probe}`,
  terminationShock: 'Termination shock',
  signal: {
    listen: '▶ Listen to the signal',
    note: 'Our own test picture, encoded the way the record stores its pictures - computed in your browser, nothing is loaded.',
  },
  // The route's clock: the date, then each probe's distance from the Sun and its signal's travel time.
  distance: (probe: string, au: string, billionKm: string, lightHours: string) => `${probe}: ${au} AU · ${billionKm} billion km · signal ${lightHours} h`,
  photoCredit: (credit: string) => `Photo: ${credit}`,
  // Everything shown comes with the app; these links are the only way out of it.
  externalLink: 'Opens an external website in a new tab - you leave the app, and that site sees your visit.',
  bundledNote: 'Included with the app - nothing is loaded from the internet.',
  charts: {
    gravityAssist: {
      title: 'Voyager 2’s speed around the Sun',
      speed: 'Speed',
      escape: 'Speed needed to leave the solar system',
      unit: 'km/s',
      source: 'Data: NASA/JPL Horizons',
      flybys: { jupiter: 'Jupiter', saturn: 'Saturn', uranus: 'Uranus', neptune: 'Neptune' },
    },
    heliopause: {
      title: { voyager1: 'Voyager 1 leaves the heliosphere, 2012', voyager2: 'Voyager 2 leaves the heliosphere, 2018' },
      protons: 'Protons from inside the bubble (3-4.6 MeV, log scale)',
      field: 'Magnetic field strength (nT)',
      source: 'Data: NASA SPDF, Voyager CRS and MAG teams',
    },
  },
}

export const voyagerLesson = {
  title: 'Voyager: the farthest journey',
  note: ROUTE_NOTE,
  chapters: {
    'two-probes': {
      title: 'Two Probes, 1977',
      text:
        'In late summer 1977 NASA launched two identical spacecraft: Voyager 2 on 20 August, Voyager 1 on ' +
        '5 September. Each weighs as much as a small car - 722 kg - and carries a dish antenna 3.7 metres ' +
        'across. They were built to last five years and to visit Jupiter and Saturn. Almost half a century ' +
        'later both are still working, and Voyager 1 is the most distant object people have ever made.',
    },
    'on-board': {
      title: 'What’s on Board',
      text:
        'The big dish always points back at Earth: through it Voyager sends its pictures and measurements ' +
        'home. The boom on one side carries the cameras and the other instruments that look at planets. On ' +
        'the opposite boom, three plutonium batteries make electricity from heat - out there sunlight is far ' +
        'too weak for solar panels. The long, thin boom holds a magnetometer far from the spacecraft’s own ' +
        'electronics, so it can measure faint magnetic fields. And on the side of the body: the Golden Record.',
    },
    'golden-record': {
      title: 'The Golden Record',
      text:
        'Each Voyager carries a gold-plated copper record, 30 cm across - a message for anyone who might ' +
        'find it, perhaps millions of years from now. A team led by Carl Sagan put on it 115 pictures, ' +
        'greetings in 55 languages, sounds of Earth - wind, rain, surf, birds, a heartbeat, a kiss - and 90 ' +
        'minutes of music from many cultures, from Bach and Beethoven to Chuck Berry, Peruvian panpipes and a ' +
        'Navajo night chant. The pictures and the music belong to their creators, so they are not part of ' +
        'this app; NASA presents them on its website.',
    },
    instructions: {
      title: 'Instructions for Finding Us',
      text:
        'The record travels in an aluminium cover engraved with instructions, written without words: in ' +
        'pictures and binary numbers. Top left: how to play it, with the stylus that flies along - and ' +
        'below, seen from the side, to start at the edge. Top right: how the pictures are stored as sound, ' +
        'line by line, and a first test picture, a circle, to check the decoding. Bottom left: a map of 14 ' +
        'pulsars - stars that flash at very steady rates - showing where the Sun is in our galaxy. Bottom ' +
        'right: the hydrogen atom, the most common atom in the universe; the time it takes to flip between ' +
        'two states is the unit every other number on the cover is counted in.',
    },
    alignment: {
      title: 'A Rare Alignment',
      text:
        'In the late 1970s Jupiter, Saturn, Uranus and Neptune stood along one side of the Sun - an ' +
        'arrangement that comes round only about every 175 years. A spacecraft could swing from one giant ' +
        'planet to the next, using each one’s gravity to speed up and turn toward the next, without the fuel ' +
        'it would otherwise need. Voyager 2 left first, on a slower path; Voyager 1 followed two weeks later ' +
        'on a faster one and overtook it in December 1977, in the asteroid belt.',
    },
    jupiter: {
      title: 'Jupiter, 1979',
      text:
        'Voyager 1 passed Jupiter on 5 March 1979, Voyager 2 on 9 July. They filmed the Great Red Spot - a ' +
        'storm bigger than Earth - turning, found a thin ring around the planet, and discovered active ' +
        'volcanoes on its moon Io: the first ever seen beyond Earth.',
    },
    saturn: {
      title: 'Saturn, 1980 and 1981',
      text:
        'Voyager 1 reached Saturn in November 1980, Voyager 2 in August 1981. They showed the rings to be ' +
        'thousands of narrow ringlets. Voyager 1 then swung close past Titan, Saturn’s big moon wrapped in ' +
        'haze - a detour that bent its path up and out of the planets’ plane, so it could visit no other ' +
        'planet. Voyager 2 flew on.',
    },
    'ice-giants': {
      title: 'Uranus and Neptune',
      text:
        'Voyager 2 is still the only spacecraft ever to visit Uranus (January 1986) and Neptune (August ' +
        '1989). At Neptune, 4.5 billion km from the Sun, it found the Great Dark Spot, the fastest winds in the ' +
        'solar system - over 2,000 km/h - and geysers on the moon Triton. Its signals took more than four ' +
        'hours to reach Earth.',
    },
    'pale-blue-dot': {
      title: 'The Pale Blue Dot',
      text:
        'On 14 February 1990, six billion kilometres from home, Voyager 1 turned its cameras back and took ' +
        'the first portrait of the solar system from outside. In it, Earth is smaller than a pixel: a pale ' +
        'blue dot in a band of scattered sunlight. Minutes later the cameras were switched off for good, to ' +
        'save power for the long journey ahead.',
    },
    interstellar: {
      title: 'Into Interstellar Space',
      text:
        'The Sun blows a wind of charged particles that inflates a bubble around the solar system, the ' +
        'heliosphere. On 25 August 2012 Voyager 1 left it, 121.6 AU from the Sun - the first human-made ' +
        'object in interstellar space. Voyager 2 followed on 5 November 2018. Today Voyager 1 is more than ' +
        '170 times as far from the Sun as Earth, and its signal takes about a day to reach us. How Voyager ' +
        'works and what it measured: the lesson “Voyager in depth”.',
    },
  },
  captions: {
    launch: 'Voyager 1 lifts off on a Titan-Centaur rocket, 5 September 1977',
    jupiter: 'Jupiter and its Great Red Spot, photographed by Voyager 1',
    saturn: 'Saturn with its moons Tethys, Enceladus and Mimas, seen by Voyager',
    neptune: 'Neptune from Voyager 2, four days before its closest approach',
    triton: 'Triton, Neptune’s largest moon, from Voyager 2',
    paleBlueDot: 'The Pale Blue Dot, reprocessed in 2020: Earth is the speck in the right-hand sunbeam',
  },
  links: {
    recordContents: 'The Golden Record’s pictures, sounds and music at NASA (science.nasa.gov)',
  },
}
