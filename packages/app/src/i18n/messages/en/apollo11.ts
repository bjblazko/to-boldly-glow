// Apollo 11, from launch to splashdown, on a drawn route between a staged Earth and Moon. Times
// and figures from NASA's "Apollo by the Numbers" (SP-4029) and the Apollo 11 Mission Report
// (MSC-00171).

export const apollo11 = {
  title: 'Apollo 11: to the Moon and Back',
  note:
    'Earth and the Moon are shown in their true sizes to each other, but five times closer together than ' +
    'they are; the orbits are drawn far higher than they were, and the Moon stands still - in the three ' +
    'days out it really moved on by about 40 degrees. Times from NASA’s “Apollo by the Numbers” and the ' +
    'Apollo 11 Mission Report.',
  chapters: {
    launch: {
      title: 'Liftoff',
      text:
        'At 9:32 in the morning of 16 July 1969, Florida time, the Saturn V lifted Apollo 11 off Launch ' +
        'Complex 39A. Less than twelve minutes later its third stage shut down in orbit, about 190 kilometres ' +
        'above Earth, with fuel left for one more burn.',
    },
    parking: {
      title: 'One and a Half Times Around',
      text:
        'For one and a half turns around Earth - about two and a half hours - the crew and Mission Control ' +
        'checked the spacecraft before it left. Each turn took about an hour and a half.',
    },
    tli: {
      title: 'Toward the Moon',
      text:
        'Over the Pacific the third stage fired again, for almost six minutes, and brought the craft to ' +
        '10.8 kilometres per second - nearly fast enough to leave Earth for good. It was aimed not at the ' +
        'Moon, but at where the Moon would be three days later.',
    },
    dock: {
      title: 'Turning Around',
      text:
        'Eagle rode folded up in the adapter below Columbia. Less than half an hour after the burn, Michael ' +
        'Collins separated Columbia, turned it around and docked its nose to Eagle’s roof, then pulled the ' +
        'lunar module free. The spent third stage was sent past the Moon into an orbit around the Sun.',
    },
    coast: {
      title: 'The Figure Eight',
      text:
        'For three days Apollo 11 coasted, slowing as Earth held it back. It flew a free return: had the ' +
        'engine failed, the Moon’s gravity would have swung it around and sent it home - the figure eight. ' +
        'Of four planned course corrections, only one was needed.',
    },
    loi: {
      title: 'Behind the Moon',
      text:
        'Apollo 11 reached the Moon on its far side, out of radio contact with Earth. There Columbia’s engine ' +
        'fired against the direction of flight for almost six minutes and braked it into orbit. Mission ' +
        'Control only learned that it had worked when the craft came out from behind the Moon.',
    },
    descent: {
      title: 'Eagle Goes Down',
      text:
        'On the thirteenth orbit Eagle undocked. Armstrong and Aldrin flew it down while Collins stayed ' +
        'aboard Columbia. A short burn on the far side lowered Eagle to 15 kilometres; from there its engine ' +
        'braked all the way down. Computer alarms and a field of boulders made the last minutes tense - ' +
        'Armstrong flew on past them and landed with less than a minute of fuel to spare.',
    },
    surface: {
      title: 'Tranquility Base',
      text:
        'Eagle landed in the Sea of Tranquility on 20 July. Six and a half hours later Neil Armstrong stepped ' +
        'onto the surface, Buzz Aldrin twenty minutes after him; they spent two and a half hours outside. ' +
        'Above them Collins circled alone, out of contact behind the Moon on every turn.',
    },
    ascent: {
      title: 'Back Up to Columbia',
      text:
        'After twenty-one and a half hours on the Moon, the ascent stage lifted off and left the descent stage ' +
        'behind. Less than four hours later it caught up with Columbia; the two docked, Armstrong and Aldrin ' +
        'climbed back through the tunnel, and the ascent stage was cast off.',
    },
    home: {
      title: 'The Way Home',
      text:
        'Again on the far side, Columbia’s engine fired for two and a half minutes and set it on course for ' +
        'Earth. The way home took two and a half days; one small correction was all it needed.',
    },
    splashdown: {
      title: 'Splashdown',
      text:
        'Shortly before arrival the service module was cast off. The command module met the atmosphere at ' +
        '11 kilometres per second, its heat shield glowing; its parachutes opened, and on 24 July it ' +
        'splashed down in the Pacific, 24 kilometres from the recovery ship USS Hornet. The mission had ' +
        'lasted eight days, three hours and eighteen minutes.',
    },
  },
  labels: {
    apollo11: 'Apollo 11',
    columbia: 'Columbia',
    eagle: 'Eagle',
    tranquilityBase: 'Tranquility Base',
    freeReturn: 'Free return',
    burns: { tli: 'Translunar injection', loi: 'Lunar orbit insertion', tei: 'Transearth injection' },
    missionTime: (time: string) => `Mission time ${time}`,
  },
  captions: {
    launch: 'Apollo 11 lifts off from Launch Complex 39A, 16 July 1969.',
    orbit: 'Eagle in lunar orbit after undocking, its legs out and its probes reaching down, photographed by Michael Collins.',
    surface: 'Eagle in the Sea of Tranquility, 20 July 1969; Buzz Aldrin unpacks the experiments from the descent stage.',
    rendezvous: 'The ascent stage, with Armstrong and Aldrin aboard, comes back up to Columbia; the Earth beyond.',
    splashdown: 'Columbia in the Pacific after splashdown, 24 July 1969, the crew in the raft beside it.',
  },
  facts: {
    liftoff: { label: 'Liftoff', value: '16 July 1969, 13:32 UTC' },
    inOrbit: { label: 'In Earth orbit after', value: '11 min 49 s' },
    period: { label: 'One turn', value: 'about 88 minutes' },
    tliBurn: { label: 'Burn', value: '5 min 47 s' },
    tliSpeed: { label: 'Speed afterwards', value: '10.8 km/s' },
    coast: { label: 'Under way', value: '73 hours' },
    correction: { label: 'Course correction', value: '6.4 m/s, after 26 h 45 min' },
    loiBurn: { label: 'Braking burn', value: '5 min 58 s' },
    loiBrake: { label: 'Slowed by', value: '889 m/s' },
    orbitHeight: { label: 'Orbit', value: 'about 100 to 120 km up' },
    descentTime: { label: 'Powered descent', value: '12 min 35 s' },
    landing: { label: 'Landing', value: '20 July 1969, 20:17 UTC' },
    firstStep: { label: 'First step', value: '21 July 1969, 02:56 UTC' },
    onMoon: { label: 'On the Moon', value: '21 h 36 min' },
    teiBurn: { label: 'Burn for home', value: '2 min 31 s' },
    entrySpeed: { label: 'Entering the atmosphere', value: '11.0 km/s' },
    duration: { label: 'Mission', value: '195 h 18 min 35 s' },
  },
}
