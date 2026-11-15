// The Voyager deep dive: how the spacecraft works and what it measured. Facts from NASA/JPL's
// Voyager mission pages and fact sheets; the charts' numbers are the probes' own data.

export const voyagerDeepDive = {
  title: 'Voyager in depth',
  note:
    'The exploded view spreads the parts apart so you can see them - in space they are one craft. The ' +
    'route is real (JPL Horizons) but drawn at Compact scale: distances compressed, planets drawn many ' +
    'times larger. The charts show real data.',
  chapters: {
    'taken-apart': {
      title: 'Taken Apart',
      text:
        'Voyager’s body is a ten-sided ring of electronics boxes, 1.8 m across, around a tank of fuel for ' +
        'its small steering thrusters. On it sit the 3.7 m dish; two booms, one for the power supply and ' +
        'one for the science platform; and the magnetometer boom, 13 m of thin fibreglass rods that were ' +
        'folded into a canister for launch. The Golden Record is fixed to the outside of the body.',
    },
    power: {
      title: 'Power from Plutonium',
      text:
        'Three radioisotope thermoelectric generators (RTGs) turn the heat of decaying plutonium-238 into ' +
        'electricity - no sunlight needed. At launch they gave about 470 watts. As the plutonium decays and ' +
        'the thermocouples age, the output falls by about 4 watts a year, so the team has been switching off ' +
        'heaters and instruments one by one to keep the rest running.',
    },
    communication: {
      title: 'A Whisper Across the Solar System',
      text:
        'Voyager talks to Earth with a transmitter of about 23 watts - a fridge light bulb - through its ' +
        '3.7 m dish. By the time the signal arrives it is so faint that only the 70-metre dishes of NASA’s ' +
        'Deep Space Network, in California, Spain and Australia, can pick it up. Data trickle home at 160 ' +
        'bits per second. Voyager 2, far south of the planets’ plane, can only be reached from Australia.',
    },
    instruments: {
      title: 'Eleven Instruments',
      text:
        'Each Voyager carries eleven science instruments. On the scan platform at the end of the science ' +
        'boom: a wide-angle and a narrow-angle camera, spectrometers for infrared and ultraviolet light and ' +
        'a photopolarimeter, all turned together toward a target. On the body and the booms: instruments for ' +
        'plasma, charged particles and cosmic rays, magnetometers, and two 10 m wire antennas listening to ' +
        'radio and plasma waves; the radio link itself is the eleventh. In interstellar space only the ' +
        'fields and particles matter - and only a few instruments are still switched on.',
    },
    'gravity-assist': {
      title: 'Gravity Assists',
      text:
        'The chart shows Voyager 2’s real speed around the Sun, from its JPL trajectory, against the speed ' +
        'it would need to escape the Sun at its distance. Leaving Earth, it was too slow - on its own it ' +
        'would have fallen back. Jupiter, Saturn and Uranus each lent it some of their own motion around the ' +
        'Sun: after Jupiter it was already fast enough to leave the solar system for good. Neptune, which ' +
        'bent its path southward, slowed it a little.',
    },
    'out-of-plane': {
      title: 'Leaving the Plane',
      text:
        'Seen edge-on, the planets all orbit in nearly one plane. Voyager 1’s close pass by Titan in 1980 ' +
        'flung it northward out of that plane, about 35 degrees. Voyager 2’s pass over Neptune’s north pole ' +
        'in 1989 sent it southward, below the plane. The two now travel in very different directions.',
    },
    heliopause: {
      title: 'Crossing the Heliopause',
      text:
        'Voyager 1’s own measurements, day by day in 2012. Within days around 25 August, the particles that ' +
        'fill the solar wind’s bubble all but vanished - protons of 3 to 4.6 MeV dropped about a hundredfold ' +
        '- and the magnetic field grew stronger and steadier. Voyager 1 had left the heliosphere. Plasma ' +
        'waves heard in 2013 confirmed it: the gas around it was some 40 times denser than inside the bubble.',
    },
    'reading-cover': {
      title: 'Reading the Cover',
      text:
        'Top left: the record from above with its stylus, and in binary the time one turn takes - 3.6 ' +
        'seconds, counted in hydrogen time. Below: the record from the side - play it from the edge inwards, ' +
        'about an hour per side. Top right: how a picture is stored - one image line’s signal, the lines ' +
        'drawn one under another, and the first picture, a circle, to check the decoding. Bottom left: the ' +
        'pulsar map. Each line points to a pulsar, its binary code tells how fast it flashes, and the long ' +
        'line runs to the galaxy’s centre. Pulsars slow down over time, so the map tells where and when. ' +
        'Bottom right: hydrogen, the clock for every number. A small spot of ultra-pure uranium-238 on the ' +
        'cover is a second clock: its decay tells how long ago the record left.',
    },
    'picture-in-sound': {
      title: 'A Picture in a Sound',
      text:
        'How do you put pictures on a record? As sound: each picture is read line by line, like an old ' +
        'television signal. Every line begins with a short pulse that dips below black - the mark for “new ' +
        'line here” - followed by the brightness along the line as the height of the signal. Played back, ' +
        'the lines are drawn one under another and the picture appears. The cover shows exactly this, top ' +
        'right, with the first picture as a test: a circle. Below, a picture of our own goes through the ' +
        'same steps. The record itself turns at 16⅔ revolutions a minute, half the speed of an LP.',
    },
    'still-talking': {
      title: 'Still Talking',
      text:
        'Almost half a century after launch, both Voyagers still send data home. To save power the team has ' +
        'switched off most instruments; a few measuring fields and particles remain. Some time in the 2030s ' +
        'the power will no longer run the transmitters and the two probes will fall silent - but they will ' +
        'fly on around the galaxy for billions of years, each with its Golden Record.',
    },
  },
}
