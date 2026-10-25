// The About dialog's "Licenses and thanks": the groups, and what each credited work does here.
export const credits = {
  groups: {
    builtIn: 'Built into the app',
    picturesAndData: 'Pictures and data',
    ownWork: 'Made for this project',
  },
  uses: {
    glMatrix: 'Matrix and vector math for the 3D view',
    assemblyScript: 'Its runtime is compiled into the orbit calculations (WebAssembly)',
    rolldown: 'A few lines of its module runtime, from bundling the app',
    interTight: 'The typeface of the controls and labels',
    ibmPlexMono: 'The typeface of numbers and readouts',
    solarSystemScope: 'Surface maps of the Sun, the planets and the Moon, and Saturn’s rings',
    nasaMoonMaps: 'Maps of Io, Europa, Ganymede, Callisto and Titan',
    earthAtNight: 'Earth’s city lights (Robert Simmon, Suomi NPP VIIRS data, NOAA)',
    brightStarCatalogue: 'The ~9,100 stars: positions, brightness, colors (Hoffleit & Warren, via CDS)',
    astronomia: 'VSOP87 coefficients for the planets’ positions',
    orbitalData: 'Rotation axes of the bodies; orbits of comets, dwarf planets and asteroids',
    agx: 'How bright light turns into screen colors',
    toBoldlyGlow: 'The app, its logo, the painted Milky Way, the Sun’s corona and the aurora',
  },
  changes: {
    solarSystemScope: 'Resized and renamed; the gas giants’ relief maps are derived from their color maps.',
  },
  licenses: {
    publicDomain: 'Public domain',
    facts: 'Facts',
    ownMethod: 'Method; own code',
  },
}
