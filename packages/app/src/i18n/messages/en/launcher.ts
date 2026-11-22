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
        'liftoff it stood on its mobile launcher: a steel platform two storeys high, covering about half ' +
        'an acre, with a tower beside it 121 metres tall. Together they weighed about 4,800 tonnes.',
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
        'stages: fuel and liquid oxygen, cold gases, air conditioning and cables. The crew access arm swung ' +
        'back five minutes before launch, the first stage’s arm seconds before; the rest let go as the ' +
        'rocket rose.',
    },
    crewArm: {
      title: 'The Way In',
      text:
        'Near the top, the crew access arm led to a small white room at the command module’s hatch. ' +
        'Through it Armstrong, Collins and Aldrin climbed aboard on the morning of 16 July 1969. Five ' +
        'minutes before launch the arm swung back.',
    },
    whiteRoom: {
      title: 'The White Room',
      text:
        'At the end of the arm, round the spacecraft’s hatch, was the White Room: a small, clean room. There ' +
        'the pad leader, Guenter Wendt, and his close-out crew helped the astronauts into their couches, ' +
        'connected their suits and shut the hatch behind them. Then they left the tower; the arm stayed ' +
        'against the spacecraft until five minutes before liftoff.',
    },
    escape: {
      title: 'The Way Out',
      text:
        'Had the rocket caught fire on the pad, there were two ways down from the top. A cab hung on a slide ' +
        'wire that ran from the tower’s 98-metre level some 760 metres out to a bunker beyond the pad. Or the ' +
        'two fast elevators: thirty storeys down at about 180 metres a minute, then a slide down a tube into a ' +
        'rubber-padded room 12 metres under the pad, behind doors like a bank vault’s, with supplies for 20 ' +
        'people for 24 hours. No crew ever had to use them.',
    },
    platform: {
      title: 'The Launch Platform',
      text:
        'The launcher’s base is a steel platform two storeys high, 49 by 40 metres, with a 14-metre square ' +
        'opening in its middle for the engines’ flame. Inside it, rooms of computers and equipment, linked to ' +
        'the launch control centre, checked the rocket until it lifted off. In the Vehicle Assembly Building ' +
        'the Saturn V was stacked on it stage by stage.',
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
    crawlerParts: {
      title: 'How the Crawler Works',
      text:
        'Two diesel engines of 2,750 horsepower each drove generators, and these sixteen electric motors in ' +
        'the four double tracks. Each track has 57 shoes, each 2.3 metres long and close to 900 kilograms. A ' +
        'separate system kept the platform level, jacked it and steered. The crawlerway beneath has two lanes, ' +
        'each a metre of selected subsoil under a metre of crushed rock, built for more than 58 tonnes on every ' +
        'square metre.',
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
    cover1: 'Mast covers',
    cover2: 'Mast covers',
    cover3: 'Mast covers',
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
    tower: { label: 'Top of the tower' },
  } as Record<string, { label: string; note?: string }>,
  captions: {
    liftoffFromTower: 'Apollo 11 rises past its tower, 16 July 1969, seen by a camera on the tower looking down: the platform, the flame beneath it.',
    crewWalk: 'Armstrong and Aldrin on their way to the spacecraft, suit technician Joe Schmidt beside them, 16 July 1969.',
    whiteRoom: 'Inside the White Room at the hatch, Apollo 10, 18 May 1969: the crew already aboard, the last checks before the hatch closes.',
    egress: 'Apollo 17’s crew on the access arm during an emergency egress test, December 1972.',
    stacking: 'Apollo 11’s first stage is lifted to be stacked on its mobile launcher in the Vehicle Assembly Building, February 1969.',
    crawlerBuilt: 'A crawler-transporter in pieces at the Cape, 1964, before its assembly.',
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
