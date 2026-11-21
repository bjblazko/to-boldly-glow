// Everything the app ships that others made, for the About dialog's "Licenses and thanks". A test
// (test/credits.test.ts) keeps it complete: every runtime package and every file in public/ is
// covered by an entry, and every license text an entry names is shipped. CREDITS.md has the long
// form, with file lists and sources.

import { msg } from '../i18n/i18n'

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

const TEXT = msg.credits
const CC_BY_4 = 'https://creativecommons.org/licenses/by/4.0/'

const SOLAR_SYSTEM_SCOPE_FILES = ['sun', 'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'moon'].map((id) => `textures/${id}.jpg`)

export const CREDIT_GROUPS: CreditGroup[] = [
  {
    title: TEXT.groups.builtIn,
    credits: [
      {
        name: 'gl-matrix',
        use: TEXT.uses.glMatrix,
        license: 'MIT',
        home: 'https://glmatrix.net/',
        text: 'licenses/gl-matrix.txt',
        package: 'gl-matrix',
      },
      {
        name: 'AssemblyScript',
        use: TEXT.uses.assemblyScript,
        license: 'Apache-2.0',
        home: 'https://www.assemblyscript.org/',
        text: 'licenses/assemblyscript.txt',
        package: 'assemblyscript',
      },
      {
        name: 'Rolldown',
        use: TEXT.uses.rolldown,
        license: 'MIT',
        home: 'https://rolldown.rs/',
        text: 'licenses/rolldown.txt',
        package: 'rolldown',
      },
      {
        name: 'Inter Tight',
        use: TEXT.uses.interTight,
        license: 'OFL-1.1',
        home: 'https://github.com/rsms/inter-tight',
        text: 'licenses/inter-tight.txt',
        package: '@fontsource-variable/inter-tight',
      },
      {
        name: 'IBM Plex Mono',
        use: TEXT.uses.ibmPlexMono,
        license: 'OFL-1.1',
        home: 'https://github.com/IBM/plex',
        text: 'licenses/ibm-plex-mono.txt',
        package: '@fontsource/ibm-plex-mono',
      },
    ],
  },
  {
    title: TEXT.groups.picturesAndData,
    credits: [
      {
        name: 'Solar System Scope',
        use: TEXT.uses.solarSystemScope,
        license: 'CC BY 4.0',
        home: 'https://www.solarsystemscope.com/textures/',
        text: CC_BY_4,
        changes: TEXT.changes.solarSystemScope,
        files: [...SOLAR_SYSTEM_SCOPE_FILES, 'textures/saturn_ring.png', ...['jupiter', 'saturn', 'uranus', 'neptune'].map((id) => `textures/${id}_bump.png`)],
      },
      {
        name: 'NASA / JPL / USGS',
        use: TEXT.uses.nasaMoonMaps,
        license: TEXT.licenses.publicDomain,
        home: 'https://photojournal.jpl.nasa.gov/',
        files: ['textures/io.jpg', 'textures/europa.jpg', 'textures/ganymede.jpg', 'textures/callisto.jpg', 'textures/titan.jpg'],
      },
      {
        name: 'NASA Earth Observatory, “Earth at Night” 2012',
        use: TEXT.uses.earthAtNight,
        license: TEXT.licenses.publicDomain,
        home: 'https://earthobservatory.nasa.gov/images/79765/night-lights-2012-map',
        files: ['textures/earth_night.png'],
      },
      {
        name: 'NASA 3D Resources, “Voyager Probe (B)”',
        use: TEXT.uses.voyagerModel,
        license: TEXT.licenses.publicDomain,
        home: 'https://github.com/nasa/NASA-3D-Resources',
        changes: TEXT.changes.voyagerModel,
        files: ['models/voyager/voyager.bin', 'models/voyager/voyager.json', 'models/voyager/voyager-color.jpg', 'models/voyager/voyager-grey.jpg'],
      },
      {
        name: 'NASA/JPL, “The Sounds of Earth” (GPN-2000-001976, GPN-2000-001978)',
        use: TEXT.uses.goldenRecord,
        license: TEXT.licenses.publicDomain,
        home: 'https://commons.wikimedia.org/wiki/File:The_Sounds_of_Earth_Record_Cover_-_GPN-2000-001978.jpg',
        changes: TEXT.changes.cropped,
        files: ['models/voyager/record-cover.jpg', 'models/voyager/record-label.jpg'],
      },
      {
        name: 'NASA/JPL-Caltech, Voyager photos (Photojournal: PIA00024, PIA00042, PIA00379, PIA00459, PIA01383, PIA01384, PIA01486, PIA01492, PIA02246, PIA18182, PIA21744, PIA21747, PIA23645)',
        use: TEXT.uses.voyagerPhotos,
        license: TEXT.licenses.publicDomain,
        home: 'https://photojournal.jpl.nasa.gov/',
        changes: TEXT.changes.resized,
        files: ['images/voyager/'],
      },
      {
        name: 'NASA: “Saturn V News Reference” (1968), “Saturn V Flight Manual SA-506”, “Saturn V Launch Vehicle Flight Evaluation Report AS-506”, “Apollo 11 Mission Report”, “Stages to Saturn” (SP-4206)',
        use: TEXT.uses.saturnVModel,
        license: TEXT.licenses.publicDomain,
        home: 'https://archive.org/details/saturn-v-news-reference',
        changes: TEXT.changes.saturnVModel,
        files: ['models/saturnV/'],
      },
      {
        name: 'NASA (HQ, MSFC, KSC, JSC), Apollo photos (NASA Image and Video Library: 6901000, KSC-69P-372, 9903405, 6758331, 6861994, 0100806, 372772main_GPN-2000-001212_full, S69-40758, S69-38317)',
        use: TEXT.uses.saturnVPhotos,
        license: TEXT.licenses.publicDomain,
        home: 'https://images.nasa.gov/',
        changes: TEXT.changes.resized,
        files: ['images/apollo/'],
      },
      {
        name: 'North American Rockwell for NASA, “Apollo Spacecraft News Reference” (1968)',
        use: TEXT.uses.csmModel,
        license: TEXT.licenses.publicDomain,
        home: 'https://archive.org/details/apollo-spacecraft-news-reference-1968',
        changes: TEXT.changes.csmModel,
        files: ['models/columbia/csm.bin', 'models/columbia/csm.json', 'models/columbia/csm-palette.png'],
      },
      {
        name: 'Smithsonian National Air and Space Museum, “Command Module Apollo 11: Interior” (3D scan)',
        use: TEXT.uses.columbiaCabin,
        license: 'CC0 1.0',
        home: 'https://3d.si.edu/object/3d/command-module-apollo-11:d8c63e8a-4ebc-11ea-b77f-2e728ce88125',
        changes: TEXT.changes.columbiaCabin,
        files: ['models/columbia/cabin.bin', 'models/columbia/cabin.json', 'models/columbia/cabin-hull.jpg', 'models/columbia/cabin-panels.jpg', 'models/columbia/cabin-seats.jpg', 'models/columbia/cabin-notes.jpg'],
      },
      {
        name: 'Grumman Aircraft Engineering Corporation for NASA, “Apollo Lunar Module News Reference” (1968)',
        use: TEXT.uses.lmModel,
        license: TEXT.licenses.publicDomain,
        home: 'https://archive.org/details/apollo-lunar-module-news-reference-1968',
        changes: TEXT.changes.lmModel,
        files: ['models/eagle/'],
      },
      {
        name: 'NASA/JPL Horizons (Giorgini & JPL Solar System Dynamics Group)',
        use: TEXT.uses.horizons,
        license: TEXT.licenses.publicDomain,
        home: 'https://ssd.jpl.nasa.gov/horizons/',
        files: ['data/voyager/voyager1.trajectory.bin', 'data/voyager/voyager2.trajectory.bin', 'data/voyager/speeds.json', 'data/voyager/encounters/'],
      },
      {
        name: 'NASA Space Physics Data Facility, Voyager 1 and 2 merged data (CRS, MAG)',
        use: TEXT.uses.spdf,
        license: TEXT.licenses.publicDomain,
        home: 'https://spdf.gsfc.nasa.gov/pub/data/voyager/voyager1/merged/',
        files: ['data/voyager/heliopause-voyager1.json', 'data/voyager/heliopause-voyager2.json'],
      },
      {
        name: 'Yale Bright Star Catalogue, 5th ed.',
        use: TEXT.uses.brightStarCatalogue,
        license: TEXT.licenses.publicDomain,
        home: 'https://cdsarc.cds.unistra.fr/viz-bin/cat/V/50',
        files: ['stars/starCatalog.bin'],
      },
      {
        name: 'astronomia',
        use: TEXT.uses.astronomia,
        license: 'MIT',
        home: 'https://github.com/commenthol/astronomia',
        text: 'licenses/astronomia.txt',
      },
      {
        name: 'IAU WGCCRE, JPL Small-Body Database, IAU Minor Planet Center',
        use: TEXT.uses.orbitalData,
        license: TEXT.licenses.facts,
        home: 'https://ssd.jpl.nasa.gov/',
      },
      {
        name: 'Qwen3-TTS (Qwen team, Alibaba Cloud)',
        use: TEXT.uses.qwenTts,
        license: 'Apache-2.0',
        home: 'https://github.com/QwenLM/Qwen3-TTS',
        text: 'https://www.apache.org/licenses/LICENSE-2.0',
        files: ['narration/'],
      },
      {
        name: 'Minimal AgX (Benjamin Wrensch, after Troy Sobotka’s AgX)',
        use: TEXT.uses.agx,
        license: TEXT.licenses.ownMethod,
        home: 'https://iolite-engine.com/blog_posts/minimal_agx_implementation',
      },
    ],
  },
  {
    title: TEXT.groups.ownWork,
    credits: [
      {
        name: 'To Boldly Glow',
        use: TEXT.uses.toBoldlyGlow,
        license: 'MIT',
        home: 'https://github.com/bjblazko/to-boldly-glow',
        text: 'licenses/to-boldly-glow.txt',
        files: ['logo.svg', 'sky/milkyWay.jpg', 'licenses/'],
      },
    ],
  },
]
