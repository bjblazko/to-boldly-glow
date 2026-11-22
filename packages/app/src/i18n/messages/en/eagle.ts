// Eagle: Apollo 11's lunar module, outside and in. Figures from Grumman's "Apollo Lunar Module News
// Reference" for NASA (1968); the model is Project Apollo - NASSP's.

export const eagle = {
  title: 'Eagle, the Lunar Module',
  note:
    'Eagle’s outside and cockpit are Project Apollo – NASSP’s models of the lunar module (GPL), made ' +
    'by its volunteers for the Orbiter space flight simulator; the tanks and engines in the cutaway ' +
    'are ours, simplified, from the published dimensions.',
  chapters: {
    whole: {
      title: 'Eagle',
      text:
        'Seven metres tall and more than nine across its feet: the lunar module was the first crewed ' +
        'spacecraft built only to fly in a vacuum. It never had to cross an atmosphere, so it needed no ' +
        'streamlining - only to be light. Its walls are in places as thin as a few sheets of paper.',
    },
    folded: {
      title: 'Folded for the Ride',
      text:
        'On the way to the Moon Eagle rode folded up under the spacecraft, in the adapter on top of the ' +
        'Saturn V’s third stage. Its four legs were swung up against its sides. Only in lunar orbit, ' +
        'before the descent, did they unfold and lock.',
    },
    stages: {
      title: 'Two Craft in One',
      text:
        'Eagle is two spacecraft stacked: the descent stage below, with its engine, its propellant and ' +
        'the landing gear, carried both astronauts down to the surface. The ascent stage above, with the ' +
        'cabin and an engine of its own, brought them back up to Columbia.',
    },
    descent: {
      title: 'The Descent Stage, Cut Open',
      text:
        'Four tanks surround the descent engine, two of fuel and two of oxidizer. It was the first engine on ' +
        'a crewed spacecraft that could be throttled: from full thrust down to a tenth. That let Neil Armstrong hover and fly ' +
        'on across the boulders until he found a place to land.',
    },
    ascent: {
      title: 'The Ascent Stage',
      text:
        'The crew’s cabin, a tank on either side and one engine underneath - with no throttle and no ' +
        'gimbal, as simple as an engine can be, because it had to work. Sixteen small thrusters in four ' +
        'clusters at the corners steered the craft.',
    },
    inside: {
      title: 'Inside',
      text:
        'The way in is the square hatch at the front, crawling on hands and knees. Inside there are no ' +
        'seats: Armstrong and Aldrin stood, held by cables at their hips, each at his own triangular ' +
        'window. Standing saved weight and brought their eyes close to the windows.',
    },
    panels: {
      title: 'Panels and Windows',
      text:
        'In front of each of them the flight displays: the attitude ball, the crosspointer, altitude and ' +
        'rate of descent. Between them the keyboard of the guidance computer - the one whose 1202 alarms ' +
        'sounded during the landing. The windows look down and forward, at the ground they were coming to.',
    },
    liftoff: {
      title: 'Liftoff from the Moon',
      text:
        'After 21 hours on the surface the ascent stage fired and rose from the descent stage, which ' +
        'served as its launch pad. The descent stage is still standing in the Sea of Tranquility today, ' +
        'with the plaque on its leg.',
    },
  },
  parts: {
    descent: 'Descent stage',
    descentInside: 'Tanks and descent engine',
    leg0: 'Landing gear',
    leg1: 'Landing gear',
    leg2: 'Landing gear',
    leg3: 'Landing gear',
    link0: 'Struts',
    link1: 'Struts',
    link2: 'Struts',
    link3: 'Struts',
    ascent: 'Ascent stage',
    ascentInside: 'Tanks and ascent engine',
    cockpit: 'Cabin',
    panels: 'Flight displays',
    dsky: 'Guidance computer keyboard',
    windows: 'Windows',
    person: 'A person (1.8 m)',
  },
  marks: {
    descent: { label: 'Top of the descent stage' },
    ascent: { label: 'Top of the ascent stage' },
  } as Record<string, { label: string; note?: string }>,
  captions: {
    surface: 'Eagle in the Sea of Tranquility, 20 July 1969; Buzz Aldrin unpacks the experiments from the descent stage.',
    orbit: 'Eagle in lunar orbit after undocking, its legs out and its probes reaching down, photographed by Michael Collins.',
    hatch: 'Buzz Aldrin backs out of the hatch onto the porch, feet first, before climbing down the ladder.',
    rendezvous: 'The ascent stage, with Armstrong and Aldrin aboard, comes back up to Columbia; the Earth beyond.',
  },
  facts: {
    height: { label: 'Height', value: 'about 7 m' },
    width: { label: 'Across the legs', value: 'about 9.4 m' },
    mass: { label: 'Mass, fuelled', value: 'about 15 t' },
    descentEngine: { label: 'Descent engine', value: '44 kN, throttled down to a tenth' },
    ascentEngine: { label: 'Ascent engine', value: '15.6 kN' },
    room: { label: 'Room to live in', value: 'about 4.5 m³' },
  },
}
