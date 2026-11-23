// The Apollo 11 tour's words (missions/apollo11/apollo11Stations.ts): each station's title and what
// the narrator says (captioned for now - not recorded yet). Times and figures from Apollo by the
// Numbers (NASA SP-4029) and the Apollo 11 Mission Report.

export const apollo11Tour = {
  title: 'Apollo 11: to the Moon and back, at true scale',
  meta: 'Earth orbit to splashdown on the real path · 13 stations · about 25 minutes',
  stations: {
    earthOrbit: {
      title: 'In Earth orbit',
      text:
        'Twelve minutes after liftoff Columbia, Eagle and the third stage circle Earth 190 kilometres up. For a ' +
        'turn and a half the crew and Houston check every system. Night falls every forty-five minutes.',
    },
    tli: {
      title: 'Off to the Moon',
      text:
        'Over the Pacific the third stage lights again: translunar injection. Six minutes later Apollo 11 is ' +
        'flying at almost eleven kilometres a second - fast enough to coast all the way to the Moon.',
    },
    docking: {
      title: 'Transposition and docking',
      text:
        'Michael Collins separates Columbia, turns it round and docks nose to nose with Eagle, still sitting in ' +
        'the top of the third stage. Then he pulls the lunar module free. The spent stage falls behind.',
    },
    coast: {
      title: 'Three days of coasting',
      text:
        'For three days the spacecraft coasts, slowly rolling so the Sun warms every side evenly. Earth shrinks ' +
        'behind, the Moon grows ahead - and the further they go, the slower they fly, until the Moon pulls ' +
        'harder than Earth.',
    },
    loi: {
      title: 'Behind the Moon',
      text:
        'Behind the Moon, out of radio contact with Earth, Columbia fires its main engine against the direction of ' +
        'flight for six minutes. When it comes round again, it is in orbit. Houston learns only then that the ' +
        'burn worked.',
    },
    undocking: {
      title: 'The Eagle has wings',
      text:
        'Armstrong and Aldrin float over into Eagle, unfold its legs and undock. "The Eagle has wings." Collins ' +
        'looks it over from Columbia. Behind the Moon Eagle brakes, onto a path that dips to fifteen kilometres.',
    },
    landing: {
      title: 'The landing',
      text:
        'Powered descent. Program alarms - 1202, 1201 - the computer is overloaded but keeps flying. Below, the ' +
        'planned site is a crater strewn with boulders; Armstrong takes over and flies on. With seconds of fuel ' +
        'to spare: "The Eagle has landed."',
    },
    firstStep: {
      title: 'The first step',
      text:
        'Six and a half hours later Armstrong climbs down the ladder. At 2:56 in the morning, Universal Time, on ' +
        '21 July 1969, he steps onto the Moon. Aldrin follows twenty minutes later.',
    },
    columbiaAlone: {
      title: 'Columbia alone',
      text:
        'Meanwhile Michael Collins orbits alone, every two hours behind the Moon, out of touch with everybody. ' +
        'He never quite finds Eagle on the ground through his sextant.',
    },
    liftoff: {
      title: 'Liftoff from the Moon',
      text:
        'After twenty-one and a half hours on the Moon the ascent stage lights. The descent stage stays behind as ' +
        'its launch pad. A broken circuit breaker had been pushed in with a felt-tip pen.',
    },
    rendezvous: {
      title: 'Rendezvous',
      text:
        'Eagle catches up with Columbia in four careful burns, rising from below and behind. Three and a half hours ' +
        'after liftoff the two dock again; Armstrong and Aldrin float back into Columbia with the samples.',
    },
    tei: {
      title: 'The way home',
      text:
        'Behind the Moon again, the main engine fires for two and a half minutes: transearth injection. Two and a ' +
        'half days of coasting home - falling toward Earth, ever faster.',
    },
    entry: {
      title: 'Entry',
      text:
        'Fifteen minutes before entry the command module leaves its service module. It hits the air at eleven ' +
        'kilometres a second, heat shield first, wrapped in glowing plasma - and splashes down in the Pacific.',
    },
  },
}
