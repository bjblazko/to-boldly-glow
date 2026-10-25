// The "Get to know the planets" lesson's words: each planet's intro and atmosphere, the facts'
// labels, the units, and the Sort menu's orders.
export const planets = {
  intros: {
    mercury:
      'The smallest planet and the closest to the Sun. With almost no air to hold the heat, its days ' +
      'are scorching and its nights freezing.',
    venus:
      "Nearly Earth's twin in size, but its thick air traps so much heat that it is the hottest " +
      'planet - hotter even than Mercury, which is closer to the Sun.',
    earth: 'Our home, and the largest of the four rocky planets - the only world known to have oceans on its surface, and life.',
    mars: 'The red planet, about half as wide as Earth: rusty dust colors it red, and it has the tallest volcano in the Solar System.',
    jupiter: 'The largest planet, more than twice as massive as all the others together. A gas giant: it has no solid surface to stand on.',
    saturn: 'The ringed planet. Its rings are about 280,000 km across but mostly only about 10 meters thick - and Saturn itself is so light it would float in water.',
    uranus: 'An ice giant that rolls around the Sun on its side: its axis is tipped over by 98°, so each pole has 42 years of day, then 42 years of night.',
    neptune: 'The farthest planet: an ice giant with the fastest winds in the Solar System, up to 2,000 km/h. Sunlight takes over four hours to get there.',
  } as Record<string, string>,
  atmospheres: {
    mercury: 'No - only traces',
    venus: 'Yes, very thick: CO₂',
    earth: 'Yes: nitrogen, oxygen',
    mars: 'Yes, thin: CO₂',
    jupiter: 'Yes: hydrogen, helium',
    saturn: 'Yes: hydrogen, helium',
    uranus: 'Yes: hydrogen, helium, methane',
    neptune: 'Yes: hydrogen, helium, methane',
  } as Record<string, string>,
  types: { rocky: 'Rocky planet', gasGiant: 'Gas giant', iceGiant: 'Ice giant' },
  facts: {
    diameter: 'Diameter',
    circumference: 'Circumference',
    mass: 'Mass',
    type: 'Type',
    atmosphere: 'Atmosphere',
    cloudTops: 'Cloud tops',
    temperature: 'Temperature',
    fromSun: 'From the Sun',
    spin: 'One spin',
    year: 'Year',
  },
  units: {
    dayAndNight: (temperature: string) => `${temperature}, day and night`,
    range: (from: string, to: string) => `${from} to ${to}`,
    billionKm: (value: string) => `${value} billion km`,
    millionKm: (value: string) => `${value} million km`,
    timesEarth: (value: string) => `${value} × Earth`,
    hours: (value: string) => `${value} hours`,
    days: (value: string) => `${value} days`,
    years: (value: string) => `${value} years`,
    backwards: (time: string) => `${time}, backwards`,
  },
  orders: {
    distance: { name: 'Out from the Sun', hint: '' },
    size: { name: 'Size', hint: '' },
    mass: { name: 'Mass', hint: '' },
    type: { name: 'Rock, gas or ice', hint: '' },
    speed: { name: 'Speed around the Sun', hint: 'The closer to the Sun, the faster a planet flies.' },
    day: { name: 'Length of a day', hint: 'From one sunrise to the next - not the same as one spin.' },
    year: { name: 'Length of a year', hint: '' },
    temperature: { name: 'Temperature', hint: 'On average. On the giants: at the top of their clouds.' },
    density: { name: 'Density', hint: 'Water has 1 g/cm³ - Saturn would float in it.' },
    gravity: { name: 'Gravity', hint: 'How heavy you would feel. On the giants: at the top of their clouds.' },
    tilt: { name: 'Axial tilt', hint: 'Over 90°, a planet spins backwards.' },
  },
}
