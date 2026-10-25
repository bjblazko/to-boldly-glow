// The lessons' words: each lesson's title and note, and its chapters' titles and texts, by chapter id.
export const lessons = {
  topics: {
    planets: 'Planets & scale',
    earthAndMoon: 'Earth & Moon',
    skyEvents: 'Sky events',
  },
  seasons: {
    title: 'Why does Earth have seasons?',
    note:
      'Not to scale: the Sun and Earth are drawn far larger and closer together than they really ' +
      'are, and Earth spins and orbits much faster than real. All angles shown are true.',
    chapters: {
      orbit: {
        title: 'Real Orbit: Earth Around the Sun',
        text:
          'Watch Earth actually orbit the Sun. Its axis always points the same fixed direction in ' +
          'space - it never tips toward the Sun and never straightens up to face it. But because ' +
          "Earth's position keeps changing, the angle between that fixed axis and the Sun keeps " +
          'changing too: sometimes leaning toward the Sun, sometimes away from it, and twice a lap ' +
          'exactly side-on. That changing angle - not the axis itself moving - is the real reason ' +
          'Earth has seasons. The number shows how much of the 23.4° tilt points toward or away from ' +
          "the Sun right now. (Earth briefly passes behind the Sun from this camera's angle once per " +
          "lap - that's just this viewpoint, not anything unusual happening in space.)",
      },
      intro: {
        title: 'Intro: A Tilted World',
        text:
          "Earth's axis is tilted 23.4° relative to its orbit around the Sun, all year round. This tilt " +
          "- not Earth's distance from the Sun, which barely changes over a year - is what causes the " +
          'seasons: what changes is which way the tilt points relative to the Sun. Watch Location A ' +
          '(north) and Location B (south) as you step through the chapters below.',
      },
      'march-equinox': {
        title: 'March Equinox',
        text:
          "Around the March equinox, Earth's axis is still tilted 23.4°, but sideways: neither toward " +
          'nor away from the Sun (from this viewpoint it leans away from you). So the Sun sits directly ' +
          "over Earth's equator, and Location A and Location B get close to equal day and night length.",
      },
      'june-solstice': {
        title: 'June Solstice',
        text:
          'The June solstice: the north pole tilts toward the Sun. Location A (north) gets longer days ' +
          'and more direct sunlight - summer. Location B (south) gets shorter days and more oblique ' +
          'sunlight - winter.',
      },
      'september-equinox': {
        title: 'September Equinox',
        text:
          'Around the September equinox, the tilt points sideways again - this time leaning toward ' +
          'you. The Sun is back over the equator, and Location A and Location B get close to equal day ' +
          'and night again - the reverse trend from March.',
      },
      'december-solstice': {
        title: 'December Solstice',
        text:
          'The December solstice: the south pole tilts toward the Sun. Location B (south) gets longer ' +
          'days and more direct sunlight - summer. Location A (north) gets shorter days and more ' +
          'oblique sunlight - winter.',
      },
    },
  },
  moonPhases: {
    title: 'Why does the Moon have phases?',
    note: (skyEnlargement: number, tiltExaggeration: number) =>
      'Not to scale: the Moon is drawn far closer to Earth than it is, goes around in seconds instead ' +
      `of a month, and seen from the ground looks about ${skyEnlargement} times bigger than in the sky. ` +
      `In the side view its orbit is tilted about ${tiltExaggeration} times more steeply than its real ` +
      '5°. True to life: which part of the Moon the Sun lights, and so its shape from Earth.',
    chapters: {
      'always-half-lit': {
        title: 'Always Half Lit',
        text:
          'The Sun always lights exactly half of the Moon - the half facing it, just as it lights half ' +
          'of Earth. What changes over a month is how much of that lit half faces us. At new moon it ' +
          'faces away; at full moon it faces us; at first and last quarter we see half of it. The card ' +
          'in the corner shows the Moon as seen from Earth right now.',
      },
      'not-earths-shadow': {
        title: "Not Earth's Shadow",
        text:
          "A common mix-up: the phases are not Earth's shadow on the Moon. Earth's shadow points " +
          'straight away from the Sun, so the Moon could only be in it at full moon - just when we see ' +
          "it fully lit. And because the Moon's orbit is tilted, the full Moon nearly always passes a " +
          'little above or below the shadow. When it does pass through, that is a lunar eclipse - a rare ' +
          'event, not the monthly phases.',
      },
      'same-face': {
        title: 'Always the Same Face',
        text:
          'The Moon turns once around itself in exactly the time it takes to go once around Earth, so ' +
          'it always shows us the same side - the marker points at its middle. The far side is not ' +
          'dark, though: at new moon it is the far side that lies in full sunlight. And from one new ' +
          "moon to the next takes 29.5 days, about two days more than the Moon's 27.3-day trip around " +
          'Earth: meanwhile Earth has moved on along its orbit, so the Moon needs a little longer to ' +
          'line up with the Sun again.',
      },
      'evening-crescent': {
        title: 'From the Ground: Evening Crescent',
        text:
          'About three days after new moon, look west just after sunset: a thin crescent hangs low over ' +
          'the glow where the Sun went down, its lit side turned toward it. The rest of the Moon glows ' +
          "faintly too: that's earthshine, sunlight reflected by Earth's day side - which, seen from " +
          'the Moon, is nearly full. Each evening the Moon stands about 12° farther from the Sun, and its ' +
          'crescent grows.',
      },
      'first-quarter': {
        title: 'First Quarter',
        text:
          'A week after new moon, the Moon has gone a quarter of the way around Earth and stands 90° ' +
          'from the Sun. At sunset it is in the south, its right half lit (seen from the southern ' +
          'hemisphere, its left). It is called a quarter for where the Moon is in its orbit, not for ' +
          'its shape.',
      },
      'full-moon': {
        title: 'Full Moon Rising',
        text:
          'Two weeks after new moon, the Moon stands opposite the Sun: as the Sun sets in the west, ' +
          'the full Moon rises in the east, and it stays up all night. Above the eastern horizon at ' +
          'dusk, look for a pink band - the Belt of Venus, sunlight still reaching the high air - over ' +
          "the darker blue of Earth's own shadow.",
      },
      'last-quarter': {
        title: 'Last Quarter',
        text:
          'Three weeks in, the Moon has gone three quarters of the way around. It rises around ' +
          'midnight and is still in the southern sky at sunrise, now lit on its left. Over the next ' +
          'week it shrinks back to a thin crescent in the dawn - and then to new moon, when it passes ' +
          'between the Sun and Earth and can cause a solar eclipse.',
      },
    },
  },
  solarEclipse: {
    title: 'What happens in a solar eclipse?',
    note: (tiltExaggeration: number, skyEnlargement: number) =>
      'Not to scale: the Sun, Moon and Earth are drawn far closer together than they are, the ' +
      `Moon's orbit is tilted about ${tiltExaggeration} times more steeply than its real 5°, and ` +
      `seen from the ground the Sun and Moon look about ${skyEnlargement} times bigger than in the ` +
      'sky. True to life: how big Earth and the Moon are compared, and the Moon looking just about ' +
      'as big as the Sun.',
    chapters: {
      'new-moon': {
        title: 'New Moon: Sun, Moon and Earth in a Row',
        text:
          'The Moon goes around Earth every 29.5 days. At new moon it passes between the Sun and ' +
          'Earth - and if the three line up exactly, the Moon blocks the sunlight and its shadow falls ' +
          'on Earth: a solar eclipse. The shadow has two parts. Inside the umbra (between the red ' +
          "lines) the Moon hides all of the Sun; it narrows to a point just behind Earth's surface, " +
          'so it touches Earth only as a small spot. Inside the much wider penumbra (between the blue ' +
          'lines) the Moon hides only part of the Sun.',
      },
      'tilted-orbit': {
        title: 'Why Not Every Month?',
        text:
          "The Moon's orbit is tilted by about 5° against Earth's orbit around the Sun. So at most new " +
          'moons the Moon passes a little above or below the Sun, and its shadow misses Earth. Only ' +
          'when new moon falls near one of the two points where the Moon crosses the plane of ' +
          "Earth's orbit do Sun, Moon and Earth line up. As Earth travels around the Sun, that " +
          'happens in two short "eclipse seasons" a year - which is why there are only two to five ' +
          'solar eclipses a year.',
      },
      'shadow-on-earth': {
        title: "The Moon's Shadow on Earth",
        text:
          "Seen from space, the Moon's shadow is a dark smudge sweeping across Earth's day side - " +
          'satellites photograph it during every eclipse. Everyone inside the penumbra (blue), a ' +
          'region thousands of kilometers wide, sees a partial eclipse. Only inside the umbra (red), ' +
          'at most about 270 km wide, does the Sun disappear completely. The umbra races across Earth ' +
          'at 1,700 km/h or more and draws a narrow "path of totality", so at any one place totality ' +
          'lasts only a few minutes - never more than about 7.5.',
      },
      'first-contact': {
        title: 'From the Ground: Just a Sunny Day?',
        text:
          'Now we stand on Earth, in the path of totality. The Moon has already started to cover the ' +
          'Sun from its western edge - but nobody would notice: the sky stays bright blue, and the Sun ' +
          'still dazzles, far too bright to look at. Never look straight at the Sun, not even for a ' +
          'moment and not even when most of it is covered: it can burn the retina for good, without ' +
          'any pain.',
      },
      partial: {
        title: 'Through Eclipse Glasses: A Bite out of the Sun',
        text:
          'Eclipse glasses (made to the ISO 12312-2 standard; sunglasses are not nearly enough) let ' +
          'through only about a hundred-thousandth of the sunlight. Everything else goes black, and the Sun ' +
          'shows as what it has become: a crescent, growing thinner for about an hour as the Moon ' +
          'slides across it. The daylight hardly changes until almost all of the Sun is covered.',
      },
      'diamond-ring': {
        title: 'The Diamond Ring',
        text:
          "Seconds before totality, the last rays of sunlight shine through valleys on the Moon's edge " +
          "and the Sun's glowing outer atmosphere starts to show around the dark Moon: the diamond " +
          'ring. The light now fades within seconds, and the sky darkens. Keep the eclipse glasses on ' +
          'until the diamond has gone out.',
      },
      totality: {
        title: 'Totality',
        text:
          'The Moon covers all of the Sun - now, and only now, it is safe to look without glasses. The ' +
          "corona appears, the Sun's outer atmosphere, over a million degrees hot, with red " +
          "prominences at the Moon's edge. The sky turns deep blue, a sunset glow rings the whole " +
          'horizon, the brightest stars and planets come out, and it gets noticeably cooler. A perfect ' +
          'fit: the Sun is about 400 times wider than the Moon, but also about 400 times farther away. ' +
          'The next total eclipse, on 2 August 2027, crosses southern Spain, North Africa and Egypt.',
      },
      annular: {
        title: 'Ring of Fire',
        text:
          "The Moon's orbit is not a perfect circle. When an eclipse comes while the Moon is near its " +
          'farthest point from Earth, it looks slightly smaller than the Sun and cannot cover it: its ' +
          'umbra ends before it reaches Earth, and a ring of fire stays around the Moon. This annular ' +
          'eclipse never gets dark and the corona stays hidden - the eclipse glasses stay on the ' +
          'whole time.',
      },
    },
  },
  planetSizes: {
    title: 'Get to know the planets',
    note: 'Sizes are to scale. Distances are not: the planets are lined up side by side.',
    lineup: {
      title: 'The Solar System, to Scale',
      text:
        'The Sun and all 8 planets side by side, at their true relative sizes. ' +
        "The Sun alone holds about 99.8% of the Solar System's mass - it dwarfs even Jupiter, the " +
        'largest planet, which in turn dwarfs Earth. This lineup shows size only, not distance: ' +
        "the planets' real spacing (light-hours to light-days apart) would spread them far outside " +
        'any single view. They start in their order out from the Sun; Sort lines them up by size, ' +
        'mass, temperature and more. The following pages fly to each planet in turn, with its own numbers.',
    },
  },
}
