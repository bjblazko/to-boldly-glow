// The launch tower and the crawler: the Saturn V's mobile launcher, its umbilical tower and swing
// arms, and the crawler-transporter. Figures from NASA/MSFC's "Saturn V News Reference" (December
// 1968); the models are Project Apollo - NASSP's, the rocket ours.

export const launcher = {
  title: 'The Launch Tower and the Crawler',
  note:
    'The launcher, its tower and the crawler are Project Apollo – NASSP’s models (GPL), made by its ' +
    'volunteers for the Orbiter space flight simulator; the Saturn V on it is ours. Figures from NASA’s ' +
    'Saturn V News Reference (1968).',
  chapters: {
    whole: {
      title: 'Rocket and Tower',
      text:
        'The Saturn V never stood on the ground by itself. From the Vehicle Assembly Building until ' +
        'liftoff it stood on its mobile launcher: a steel platform two storeys high, covering more than ' +
        'half an acre, with a tower beside it 121 metres tall. Together they weighed about 4,800 tonnes.',
    },
    tower: {
      title: 'The Umbilical Tower',
      text:
        'The tower is an open steel frame with 18 work platforms, two fast elevators and a crane on top. ' +
        'Up through it ran the lines for propellant, compressed gases, electricity, water and ' +
        'communications that kept the rocket supplied until the last seconds.',
    },
    arms: {
      title: 'Nine Arms',
      text:
        'Nine service arms reached across from the tower to the rocket and carried those lines into its ' +
        'stages: fuel and liquid oxygen, cold gases, air conditioning and cables. Some swung back minutes ' +
        'before launch; the rest let go in the seconds the rocket rose.',
    },
    crewArm: {
      title: 'The Way In',
      text:
        'Near the top, the crew access arm led to a small white room at the command module’s hatch. ' +
        'Through it Armstrong, Collins and Aldrin climbed aboard on the morning of 16 July 1969. Five ' +
        'minutes before launch the arm swung back.',
    },
    holddown: {
      title: 'Held Down',
      text:
        'Four hold-down arms gripped the base of the first stage. The five engines needed seconds to ' +
        'build up full thrust: the arms held the Saturn V for about 8.9 seconds after ignition, until ' +
        'every engine was running as it should, and only then let it go.',
    },
    crawler: {
      title: 'The Crawler',
      text:
        'To reach the pad, launcher, tower and rocket rode together on the crawler-transporter, one of ' +
        'the largest land vehicles ever built: about 2,700 tonnes on four double tracks. Loaded, it crept ' +
        'along at 1.6 kilometres an hour for 5.6 kilometres, keeping its deck level within a sixth of a ' +
        'degree. Apollo 11 made the trip on 20 May 1969.',
    },
    liftoff: {
      title: 'Liftoff',
      text:
        'At 9:32 in the morning of 16 July 1969 the five engines lit. The arms swung back, the hold-down ' +
        'arms let go, and Apollo 11 rose past the tower on its way to the Moon.',
    },
  },
  parts: {
    launcher: 'Mobile launcher',
    holddown: 'Hold-down arms',
    mast1: 'Tail service masts',
    mast2: 'Tail service masts',
    mast3: 'Tail service masts',
    tower: 'Umbilical tower',
    damperArm: 'Damper arm',
    crewArm: 'Crew access arm',
    serviceArms: 'Service arms',
    intertankArm: 'S-IC intertank arm',
    rocket: 'Saturn V',
    person: 'A person (1.8 m)',
    crawler: 'Crawler-transporter',
  },
  marks: {
    deck: { label: 'Launcher deck' },
    tower: { label: 'Top of the tower', note: '398 ft' },
  } as Record<string, { label: string; note?: string }>,
  captions: {
    rollout: 'Apollo 11’s Saturn V on the crawler, on its way to the pad, 20 May 1969.',
    liftoff: 'Apollo 11 lifts off from Launch Complex 39A, 16 July 1969.',
  },
  facts: {
    tower: { label: 'Tower', value: '121 m above the deck' },
    weight: { label: 'Launcher and tower', value: 'about 4,800 t' },
    platforms: { label: 'Work platforms', value: '18' },
    elevators: { label: 'Elevators', value: 'two, 183 m a minute' },
    arms: { label: 'Service arms', value: '9' },
    holddown: { label: 'Held after ignition', value: 'about 8.9 s' },
    crawlerMass: { label: 'Crawler', value: 'about 2,700 t' },
    crawlerSpeed: { label: 'Speed, loaded', value: '1.6 km/h' },
    crawlerway: { label: 'To the pad', value: '5.6 km' },
  },
}
