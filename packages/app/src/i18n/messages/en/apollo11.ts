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
        'Then came the burn that leaves Earth behind: translunar injection, TLI. Seven months earlier, on ' +
        'Apollo 8, Michael Collins had been the voice in Houston that told the first crew ever bound for ' +
        'another world: “You are go for TLI.” He later found the words far too plain; given another chance, ' +
        'he said, he would have told them: “Apollo 8, the Moon is yours. Go.” Now, over the Pacific, the ' +
        'third stage fired for almost six minutes and brought Apollo 11 to 10.8 kilometres per second, aimed ' +
        'at where the Moon would be three days later.',
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
    undocking: {
      title: 'Eagle Lets Go',
      text:
        'Armstrong and Aldrin had crawled through the tunnel into Eagle and unfolded its legs. On the ' +
        'thirteenth orbit the two craft let go of each other, and Eagle turned slowly all the way around in ' +
        'front of Columbia, so that Collins could check its legs. “The Eagle has wings,” Armstrong radioed.',
    },
    descent: {
      title: 'Eagle Goes Down',
      text:
        'Less than an hour and a half later, on the far side, a short burn lowered Eagle’s path to 15 ' +
        'kilometres above the surface. From there, back in view of Earth, its engine braked it all the way ' +
        'down - for twelve and a half minutes - while Collins flew on alone in Columbia.',
    },
    landing: {
      title: 'The Eagle Has Landed',
      text:
        'In the last minutes the guidance computer raised alarm after alarm - overloaded, but still flying - ' +
        'and steered Eagle toward a crater strewn with boulders. Armstrong took over and flew on, looking for ' +
        'a clear place, while Aldrin called out height and speed. Then a probe under a footpad touched the ' +
        'ground, and the contact light came on. “Houston, Tranquility Base here. The Eagle has landed.”',
    },
    surface: {
      title: 'Tranquility Base',
      text:
        'Eagle landed in the Sea of Tranquility on 20 July. Six and a half hours later Neil Armstrong stepped ' +
        'onto the surface, Buzz Aldrin twenty minutes after him; they spent two and a half hours outside. ' +
        'Above them Collins circled alone, out of contact behind the Moon on every turn.',
    },
    liftoff: {
      title: 'Liftoff from the Moon',
      text:
        'After twenty-one and a half hours on the Moon the ascent engine fired. There was no second engine: ' +
        'this one had to work. The descent stage stayed behind as a launch pad; the ascent stage rose and was ' +
        'in lunar orbit about seven minutes later. Aldrin saw the flag they had set up blown over by the exhaust.',
    },
    ascent: {
      title: 'Catching Up',
      text:
        'Eagle came up into a lower orbit than Columbia’s - and a lower orbit is a faster one. A few short ' +
        'burns brought it up behind Columbia, and less than four hours after liftoff the two met again.',
    },
    rendezvous: {
      title: 'Docked Again',
      text:
        'Collins brought the two craft together, and they docked. Armstrong and Aldrin floated back through ' +
        'the tunnel into Columbia, with the boxes of Moon rock and the film. Then the ascent stage was cast ' +
        'off and left behind in lunar orbit.',
    },
    home: {
      title: 'The Way Home',
      text:
        'Again on the far side, Columbia’s engine fired for two and a half minutes and set it on course for ' +
        'Earth. The way home took two and a half days; one small correction was all it needed.',
    },
    entry: {
      title: 'Heat Shield Forward',
      text:
        'Fourteen minutes before reaching the atmosphere, the service module was cast off - with the engine, ' +
        'the oxygen and the fuel cells that had kept the crew alive for eight days. The command module turned ' +
        'its heat shield forward; from here on it flew alone.',
    },
    splashdown: {
      title: 'Splashdown',
      text:
        'The command module met the atmosphere at ' +
        '11 kilometres per second, its heat shield glowing; its parachutes opened, and on 24 July it ' +
        'splashed down in the Pacific, 24 kilometres from the recovery ship USS Hornet. The mission had ' +
        'lasted eight days, three hours and eighteen minutes.',
    },
  },
  labels: {
    apollo11: 'Apollo 11',
    columbia: 'Columbia',
    eagle: 'Eagle',
    thirdStage: 'Third stage',
    tranquilityBase: 'Tranquility Base',
    freeReturn: 'Free return',
    burns: { tli: 'Translunar injection (TLI)', loi: 'Lunar orbit insertion (LOI)', tei: 'Transearth injection (TEI)' },
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
