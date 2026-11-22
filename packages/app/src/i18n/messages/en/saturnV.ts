// The Saturn V, taken apart: Apollo 11's rocket stage by stage. Sizes and engine figures from
// NASA/MSFC's "Saturn V News Reference" (1968); Apollo 11's own mass, burn times, altitude and speed
// from the "Saturn V Launch Vehicle Flight Evaluation Report AS-506" (MPR-SAT-FE-69-9); the command
// module's landing mass from the "Apollo 11 Mission Report" (MSC-00171); the S-IVB's name from
// "Stages to Saturn" (NASA SP-4206).

export const saturnV = {
  title: 'The Saturn V, Taken Apart',
  note:
    'The model is built from the rocket’s published dimensions and drawn to scale; its insides are ' +
    'shown schematically. Where the documents leave a measure open (the spacecraft adapter, the escape ' +
    'tower, the fins), it is a close approximation.',
  chapters: {
    whole: {
      title: 'The Whole Rocket',
      text:
        'On 16 July 1969 this rocket carried Apollo 11 toward the Moon. The Saturn V stood 110.6 m tall - ' +
        'taller than the Statue of Liberty with its pedestal - and weighed 2,938 t at liftoff, almost all ' +
        'of it propellant. The small orange figure at its foot is a person, to scale. The black-and-white ' +
        'pattern was for cameras: on films shot from the ground, engineers could read how far the rocket ' +
        'rolled about its long axis as it climbed. The rest is white, to keep the sun off its ice-cold tanks.',
    },
    stack: {
      title: 'The Stack',
      text:
        'The Saturn V is three rockets stacked on each other, with a spacecraft on top. Each stage burns ' +
        'until its tanks are empty and is then thrown away, so the next one has less to carry: the S-IC, ' +
        'the S-II and the S-IVB. Above them sit the Instrument Unit, the adapter with the lunar module ' +
        'inside, the service and command modules, and the escape tower. The S-IVB’s name tells its ' +
        'story: it is an improved S-IV, which had been the second stage of the smaller Saturn I.',
    },
    sic: {
      title: 'S-IC: Five F-1 Engines',
      text:
        'The first stage lifts the whole rocket off the pad. Its five F-1 engines burn kerosene (RP-1) ' +
        'with liquid oxygen and together push with about 34 meganewtons. Every second they swallow ' +
        'almost 13 t of propellant; the oxygen runs from the upper tank through five ducts straight ' +
        'through the fuel tank below it. The centre engine shuts down after 2 minutes 15 seconds, the ' +
        'outer four after 2 minutes 42 seconds; at 67 km the empty stage drops away.',
    },
    sii: {
      title: 'S-II: Burning Hydrogen',
      text:
        'The second stage burns liquid hydrogen, at −253 °C, with liquid oxygen. Hydrogen gives more push ' +
        'per kilogram but is so light it needs a huge tank. To save length and weight, the hydrogen and ' +
        'oxygen tanks share one wall - a common bulkhead, insulated so the oxygen does not freeze against ' +
        'the colder hydrogen. Its five J-2 engines burn for 6 minutes 25 seconds.',
    },
    sivb: {
      title: 'S-IVB: Fired Twice',
      text:
        'The third stage has a single J-2 engine, and it can be restarted. Its first burn, 2 minutes ' +
        '27 seconds, puts Apollo into a parking orbit around Earth. During its second orbit, while ' +
        'the crew checks their spacecraft, it fires again for 5 minutes 47 seconds: trans-lunar ' +
        'injection, which sends Apollo 11 on its way to the Moon at about 39,000 km/h.',
    },
    iu: {
      title: 'The Instrument Unit',
      text:
        'A ring only 91 cm tall, 6.6 m across, is the rocket’s brain. Inside it are a guidance computer, ' +
        'a gyroscope platform that always knows which way is up, and radios. It steers the engines, ' +
        'times every stage separation and controls the S-IVB until the spacecraft leaves it.',
    },
    spacecraft: {
      title: 'The Spacecraft on Top',
      text:
        'Under the cone-shaped adapter waits the lunar module, legs folded. Above it are the service ' +
        'module with the main engine, fuel, oxygen and power, and the command module, home to the three ' +
        'astronauts. The tower on top could pull the command module away from a failing rocket; it was ' +
        'thrown off while the second stage was burning.',
    },
    returns: {
      title: 'What Comes Back',
      text:
        'Of the whole stack, only the command module comes home: a capsule of 4.9 t that splashed ' +
        'down in the Pacific on 24 July 1969. Everything else was thrown away along the way - the stages ' +
        'one after the other, the tower, the adapter; the lunar module stayed behind at the Moon.',
    },
  },
  parts: {
    les: 'Escape tower',
    cm: 'Command module',
    sm: 'Service module',
    sla: 'Spacecraft–LM adapter',
    lm: 'Lunar module',
    iu: 'Instrument Unit',
    sivb: 'S-IVB',
    sivbInside: 'Hydrogen and oxygen',
    sivbEngine: 'J-2',
    sii: 'S-II',
    siiInside: 'Hydrogen above oxygen',
    siiEngines: '5 × J-2',
    sic: 'S-IC',
    sicInside: 'Oxygen above kerosene',
    sicEngines: '5 × F-1',
    person: 'A person (1.8 m)',
  },
  // The stage tops marked beside the rocket.
  // The stage tops marked beside the rocket, with what the abbreviation stands for.
  marks: {
    sic: { label: 'Top of the S-IC', note: 'the first stage' },
    sii: { label: 'Top of the S-II', note: 'the second stage' },
    sivb: { label: 'Top of the S-IVB', note: 'the third stage, an improved S-IV' },
    top: { label: 'Tip of the escape tower' },
  } as Record<string, { label: string; note?: string }>,
  facts: {
    height: { label: 'Height', value: '110.6 m' },
    mass: { label: 'Mass at liftoff', value: '2,938 t' },
    diameter: { label: 'Diameter', value: '10.1 m' },
    thrust: { label: 'Thrust at liftoff', value: 'about 34 MN' },
    sicBurn: { label: 'Burns for', value: '2 min 42 s' },
    flow: { label: 'Propellant per second', value: 'almost 13 t' },
    hydrogen: { label: 'Liquid hydrogen', value: '−253 °C' },
    siiBurn: { label: 'Burns for', value: '6 min 25 s' },
    siiPropellant: { label: 'Propellant', value: '427 t' },
    tli: { label: 'Trans-lunar injection', value: '5 min 47 s' },
    tliSpeed: { label: 'Speed afterwards', value: 'about 39,000 km/h' },
    iuHeight: { label: 'Height', value: '91 cm' },
    capsule: { label: 'Command module at landing', value: '4.9 t' },
  },
  captions: {
    launch: 'Apollo 11 lifts off from Launch Complex 39A, 16 July 1969.',
    rollout: 'Apollo 11’s Saturn V on its way to the pad, 20 May 1969.',
    f1: 'An F-1 engine: 5.8 m tall, here dwarfing a technician.',
    sii: 'An S-II stage being lowered onto the S-IC in the Vehicle Assembly Building (Apollo 6).',
    sivb: 'An S-IVB on its test stand in California (Apollo 10).',
    iu: 'NASA’s chart of the Instrument Unit and its systems.',
  },
}
