// What the narrator says on the grand tour, stop by stop: on the way to a stop (`approach`, about
// 15 seconds - it starts as the ship leaves the stop before) and while circling it (`orbit`, about
// 30 seconds). Numbers below 10 are written out; larger ones, decimals and percentages are digits. The audio is made from these texts at
// build time (see packages/data-pipeline/narration/); the subtitles show them as they are.
//
// Sources: NASA's Planetary Fact Sheets (nssdc.gsfc.nasa.gov/planetary/factsheet) and planet pages
// (science.nasa.gov), and the mission results named in the text (MESSENGER, Venera, Voyager,
// Cassini-Huygens).
export const en = {
  sun: {
    approach:
      'Space: the final frontier. Welcome aboard. Our journey begins where everything in this system ' +
      'begins: at the Sun. ' +
      'Sit back - we will visit every planet, in order, from the inside out.',
    orbit:
      'The Sun holds more than 99.8 percent of all the mass in the Solar System. ' +
      'More than a million Earths would fit inside it. Deep in its core, at 15 million degrees, ' +
      'it fuses hydrogen into helium and turns four million tonnes of matter into light, every second. ' +
      'The sunlight on your face left the Sun just over eight minutes ago.',
  },
  mercury: {
    approach:
      'First stop: Mercury, the smallest planet, and the closest to the Sun. It races around it in ' +
      'just 88 days - faster than any other planet.',
    orbit:
      'With almost no air to hold the heat, Mercury bakes at 430 degrees by day ' +
      'and freezes at minus 180 at night. And its days are long: from one sunrise ' +
      'to the next takes two of its years. Strangely, this scorched world has ice - hidden in craters ' +
      'at its poles that never see the Sun. And Mercury is shrinking: as its huge iron core cools, the ' +
      'whole planet contracts, wrinkling its surface into cliffs.',
  },
  venus: {
    approach:
      'Next comes Venus - almost Earth’s twin in size, and after the Moon the brightest thing in our ' +
      'night sky. But up close, this twin is a nightmare.',
    orbit:
      'Beneath its clouds of sulfuric acid, Venus is the hottest planet of all: about ' +
      '465 degrees, hot enough to melt lead - hotter even than Mercury. Its thick carbon dioxide ' +
      'air traps the heat, and presses down 90 times harder than Earth’s, as if you were almost a ' +
      'kilometer under the sea. Venus also spins backwards, and so slowly that its day lasts longer than its year. ' +
      'The landers that reached its surface survived for two hours at most.',
  },
  earth: {
    approach:
      'And here is a planet you know. Earth - the third from the Sun, and the only world we know ' +
      'of that has life.',
    orbit:
      '71 percent of Earth’s surface is covered by liquid water - the only planet with oceans on its surface. ' +
      'It is also the densest planet in the Solar System. Right now, you are racing around the Sun at ' +
      '30 kilometers per second, more than 100,000 kilometers an hour, without feeling ' +
      'a thing. And the air we breathe? If Earth were an apple, its atmosphere would be thinner than ' +
      'the skin.',
  },
  mars: {
    approach:
      'Now we head out to Mars, the red planet. Its color comes from rust: iron in its dust, ' +
      'slowly oxidized over billions of years.',
    orbit:
      'Mars is a world of extremes. Olympus Mons, the largest volcano in the Solar System, rises more ' +
      'than twice as high as Mount Everest. Valles Marineris, a canyon 4,000 kilometers long, ' +
      'reaches about as far as from Lisbon to Moscow. Its day is only 40 minutes longer than ours - but its ' +
      'sunsets are blue. Mars has two tiny moons, and the larger one, Phobos, is slowly spiraling ' +
      'inward. In some tens of millions of years, it will break apart.',
  },
  jupiter: {
    approach:
      'Past the asteroid belt, the giants begin. Jupiter is so large that all the other planets ' +
      'together would fit inside it - with room to spare.',
    orbit:
      'More than 1,300 Earths would fit inside Jupiter, and it outweighs all the other ' +
      'planets combined more than twice over. It has no solid surface - only ever denser gas. ' +
      'The Great Red Spot is a storm wider than Earth, which has been raging for well over ' +
      '150 years. Despite its size, Jupiter spins faster than any other planet: a day lasts ' +
      'less than 10 hours. And among its many moons is Ganymede - larger than the planet Mercury.',
  },
  saturn: {
    approach:
      'Now the jewel of the Solar System: Saturn, and its rings. They span almost ' +
      '300,000 kilometers - and yet they are paper thin.',
    orbit:
      'In most places Saturn’s rings are only about 10 meters thick. They are made of countless ' +
      'pieces of ice, from specks of dust to boulders as big as a house. Saturn itself is so light ' +
      'that, in a bathtub large enough, it would float. At its north pole spins a storm shaped like ' +
      'a perfect hexagon. And its largest moon, Titan, has a thick orange sky, and lakes and rivers - ' +
      'not of water, but of liquid methane.',
  },
  uranus: {
    approach:
      'Further out lies Uranus, the first planet ever discovered with a telescope - by William ' +
      'Herschel, in 1781.',
    orbit:
      'Uranus rolls around the Sun on its side: its axis is tipped over by 98 degrees. ' +
      'Since one trip around the Sun takes 84 years, each pole has 42 years of ' +
      'daylight, followed by 42 years of night. Its blue-green color comes from methane gas. ' +
      'And though Neptune is farther out, Uranus holds the record for the coldest air of any planet: ' +
      'minus 224 degrees.',
  },
  neptune: {
    approach:
      'The last planet: Neptune. It was found with pen and paper: predicted from the way it tugged on ' +
      'Uranus, and then spotted right where the math said it would be.',
    orbit:
      'Sunlight needs more than four hours to reach Neptune. Here, the winds are the fastest in the ' +
      'Solar System - up to 2,000 kilometers an hour. One orbit takes 165 ' +
      'years: since its discovery in 1846, Neptune has gone around the Sun just once. ' +
      'Its largest moon, Triton, circles it backwards, and has geysers of nitrogen ice. Only one ' +
      'spacecraft has ever been here: Voyager 2, in 1989.',
  },
  home: {
    approach:
      'That was the last of the planets. It is time to head home - back across the Solar System, ' +
      'to the small blue world where we started.',
    orbit:
      'From the edge of the Solar System, Voyager 1 once looked back and saw Earth as a pale blue ' +
      'dot, smaller than a single pixel. Everything we know lies on that dot. Thank you for flying ' +
      'with us. The controls are now yours: explore on your own, or learn why there are seasons, ' +
      'Moon phases and eclipses.',
  },
}

export type NarrationScript = typeof en
export type NarrationStop = keyof NarrationScript
export type NarrationPart = keyof NarrationScript['sun']
