// Everything the app ships that others made, for the About dialog's "Licenses and thanks". A test
// (test/credits.test.ts) keeps it complete: every runtime package and every file in public/ is
// covered by an entry, and every license text an entry names is shipped. CREDITS.md has the long
// form, with file lists and sources.

export interface Credit {
  name: string
  // One line: what it does in this app.
  use: string
  license: string
  home: string
  // The shipped license text (`licenses/…`, next to the app) or, for a license not shipped, its URL.
  text?: string
  // How we changed it, where a license asks to say so (CC BY).
  changes?: string
  // The npm package this entry covers, if it is one.
  package?: string
  // Files in public/ this entry covers (exact paths, or a folder ending in /).
  files?: string[]
}

export interface CreditGroup {
  title: string
  credits: Credit[]
}

const CC_BY_4 = 'https://creativecommons.org/licenses/by/4.0/'

const SOLAR_SYSTEM_SCOPE_FILES = ['sun', 'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'moon'].map((id) => `textures/${id}.jpg`)

export const CREDIT_GROUPS: CreditGroup[] = [
  {
    title: 'Built into the app',
    credits: [
      {
        name: 'gl-matrix',
        use: 'Matrix and vector math for the 3D view',
        license: 'MIT',
        home: 'https://glmatrix.net/',
        text: 'licenses/gl-matrix.txt',
        package: 'gl-matrix',
      },
      {
        name: 'AssemblyScript',
        use: 'Its runtime is compiled into the orbit calculations (WebAssembly)',
        license: 'Apache-2.0',
        home: 'https://www.assemblyscript.org/',
        text: 'licenses/assemblyscript.txt',
        package: 'assemblyscript',
      },
      {
        name: 'Rolldown',
        use: 'A few lines of its module runtime, from bundling the app',
        license: 'MIT',
        home: 'https://rolldown.rs/',
        text: 'licenses/rolldown.txt',
        package: 'rolldown',
      },
      {
        name: 'Inter Tight',
        use: 'The typeface of the controls and labels',
        license: 'OFL-1.1',
        home: 'https://github.com/rsms/inter-tight',
        text: 'licenses/inter-tight.txt',
        package: '@fontsource-variable/inter-tight',
      },
      {
        name: 'IBM Plex Mono',
        use: 'The typeface of numbers and readouts',
        license: 'OFL-1.1',
        home: 'https://github.com/IBM/plex',
        text: 'licenses/ibm-plex-mono.txt',
        package: '@fontsource/ibm-plex-mono',
      },
    ],
  },
  {
    title: 'Pictures and data',
    credits: [
      {
        name: 'Solar System Scope',
        use: 'Surface maps of the Sun, the planets and the Moon, and Saturn’s rings',
        license: 'CC BY 4.0',
        home: 'https://www.solarsystemscope.com/textures/',
        text: CC_BY_4,
        changes: 'Resized and renamed; the gas giants’ relief maps are derived from their color maps.',
        files: [...SOLAR_SYSTEM_SCOPE_FILES, 'textures/saturn_ring.png', ...['jupiter', 'saturn', 'uranus', 'neptune'].map((id) => `textures/${id}_bump.png`)],
      },
      {
        name: 'NASA / JPL / USGS',
        use: 'Maps of Io, Europa, Ganymede, Callisto and Titan',
        license: 'Public domain',
        home: 'https://photojournal.jpl.nasa.gov/',
        files: ['textures/io.jpg', 'textures/europa.jpg', 'textures/ganymede.jpg', 'textures/callisto.jpg', 'textures/titan.jpg'],
      },
      {
        name: 'NASA Earth Observatory, “Earth at Night” 2012',
        use: 'Earth’s city lights (Robert Simmon, Suomi NPP VIIRS data, NOAA)',
        license: 'Public domain',
        home: 'https://earthobservatory.nasa.gov/images/79765/night-lights-2012-map',
        files: ['textures/earth_night.png'],
      },
      {
        name: 'Yale Bright Star Catalogue, 5th ed.',
        use: 'The ~9,100 stars: positions, brightness, colors (Hoffleit & Warren, via CDS)',
        license: 'Public domain',
        home: 'https://cdsarc.cds.unistra.fr/viz-bin/cat/V/50',
        files: ['stars/starCatalog.bin'],
      },
      {
        name: 'astronomia',
        use: 'VSOP87 coefficients for the planets’ positions',
        license: 'MIT',
        home: 'https://github.com/commenthol/astronomia',
        text: 'licenses/astronomia.txt',
      },
      {
        name: 'IAU WGCCRE, JPL Small-Body Database, IAU Minor Planet Center',
        use: 'Rotation axes of the bodies; orbits of comets, dwarf planets and asteroids',
        license: 'Facts',
        home: 'https://ssd.jpl.nasa.gov/',
      },
      {
        name: 'Minimal AgX (Benjamin Wrensch, after Troy Sobotka’s AgX)',
        use: 'How bright light turns into screen colors',
        license: 'Method; own code',
        home: 'https://iolite-engine.com/blog_posts/minimal_agx_implementation',
      },
    ],
  },
  {
    title: 'Made for this project',
    credits: [
      {
        name: 'To Boldly Glow',
        use: 'The app, its logo, the painted Milky Way, the Sun’s corona and the aurora',
        license: 'MIT',
        home: 'https://github.com/bjblazko/to-boldly-glow',
        text: 'licenses/to-boldly-glow.txt',
        files: ['logo.svg', 'sky/milkyWay.jpg', 'licenses/'],
      },
    ],
  },
]
