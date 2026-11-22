# To Boldly Glow

![To Boldly Glow: Earth's night side with its city lights and aurora, the Sun rising behind it, Venus, Mercury and the Moon beside it, with the planets' orbits and names(docs/images/hero.jpg)

To Boldly Glow is a free, open-source, browser-based planetarium and solar-system visualizer. It
renders the Sun, all 8 planets, and 9 major moons in 3D using real orbital mechanics (VSOP87
planetary theory) and real axial tilts, with accurate positions for any date — not just today —
along with the asteroid and Kuiper belts, notable comets and dwarf planets on their orbits. Fly
around freely like in a space game or lock the camera onto any body, run time forwards or backwards
from real-time up to years per second, and blend between true-to-scale distances and a compressed,
easier-to-explore view. Everything renders through WebGPU, with HDR bloom, lens flares, the Milky
Way, and a real ~9,100-star background in the stars' own colors from the Yale Bright Star
Catalogue.

**Try it live: [huepattl.de/products/to-boldly-glow](https://huepattl.de/products/to-boldly-glow)**
(fastest in Chrome, Edge, Chromium or Helium - see [Which browser?](#which-browser)) - or download
it and run it from your disk, no web server needed (see [Run it from the download](#run-it-from-the-download)).

## Which browser?

> **Fastest in a Chrome-based browser: Chrome, Edge, Chromium or Helium.** Safari works, but more
> slowly. Firefox works only on Windows and on Macs with Apple silicon. The app needs WebGPU; a
> browser without it shows a note instead of the scene.

| | Chrome, Edge, Chromium, Helium | Safari | Firefox |
| --- | --- | --- | --- |
| **macOS, Apple silicon** | ✅ **best** (tested: 60 fps) | ✅ 26 or newer, slower (tested: about 20 fps) | ✅ 145 or newer (tested: 155, 60 fps) |
| **macOS, Intel** | ✅ **best** | ✅ 26 or newer, slower | ❌ no WebGPU |
| **Windows** | ✅ **best** | — | ✅ 141 or newer |
| **Linux** | ⚠️ depends on the graphics driver; may need WebGPU switched on in `chrome://flags` | — | ❌ no WebGPU |
| **Android** | ✅ Chrome, Android 12 or newer | — | ❌ no WebGPU (tested) |
| **iPhone, iPad** | ✅ iOS/iPadOS 26 or newer (every browser there runs on Safari's engine) | ✅ 26 or newer | ✅ iOS/iPadOS 26 or newer (Safari's engine) |

*Tested* means run on our own devices (October 2026: a MacBook with Apple silicon on macOS 27, and
an Android phone); the rest follows the browser makers' WebGPU status. In a browser that isn't
Chrome-based the app says so once, in a small note you can close.

## Features

### The Solar System, true to the date

The Sun, all eight planets and nine major moons on their real orbits (VSOP87) with their real axial
tilts, for any date - plus the asteroid and Kuiper belts, comets with their tails, and the dwarf
planets. Run time forwards or backwards, from real time up to a year per second.

### True scale, or one you can take in

**Realistic** shows the true sizes and distances - mostly empty space, as it is. **Compact** pulls
everything close enough to see at a glance. The switch eases between them, and a note says when
what you see is not to scale.

![The inner Solar System in the Compact view, with the planets' orbits and their names](docs/images/compact.jpg)

### Light, shadow and glow

Rendered through WebGPU with HDR bloom and lens flares: Earth's night side with its city lights and
aurora, clouds and a glowing atmosphere, Saturn's rings, the Sun's corona when a planet covers it,
the Milky Way with its nebulae, and about 9,100 real stars in their own colors.

| | |
| --- | --- |
| ![Earth in front of the Sun: its night side with city lights, the aurora, and the Sun's corona around it](docs/images/corona.jpg) | ![Saturn and its rings in full sunlight](docs/images/saturn.jpg) |

### Fly it yourself

Everything is in one bar at the bottom: Start, Search, the camera, Time, View and More. Orbit any
body - drag to turn, two fingers (or the right mouse button) to slide the view, scroll or pinch to
zoom toward the pointer - or switch the camera to free flight and fly like a spaceship: the arrow
keys turn the nose, Q/E roll, W/S give thrust that builds up with weight. The keys show as keycaps
whenever you switch, and with ?. Double-click a planet to fly there and follow it; Ctrl+K searches
everything.

![Free flight past Saturn, the controls overlay showing its keys, the bar at the bottom](docs/images/free-flight.jpg)

### Tours, with a narrator

The **start page** (the bar's Start, and by itself on a first visit) holds everything there is to
start. The narrated **grand tour** flies from the Sun out to Neptune and home to Earth in about
eight minutes, with a narrator - Lyra or Orion - telling what makes each world special, and
optional subtitles. It flies at warp between the planets, at either scale. Two **Voyager tours**
follow Voyager 1 and Voyager 2 along their real paths, station by station: each planet flyby at
true scale, with NASA's photos, out to the heliopause and to where they are today.

| | |
| --- | --- |
| ![The start page: explore on your own, the grand tour with its language and narrator, the Voyager tours and the lessons](docs/images/start.jpg) | ![The grand tour approaching the Sun, with the narrator's subtitle](docs/images/grand-tour.jpg) |
| ![The Voyager 2 tour at Neptune: the flyby at true scale, the station's card with Triton, the stations in the bar](docs/images/voyager-tour.jpg) | |

### Lessons that show, and read themselves out

*Get to know the planets* (side by side at true scale, sorted by size, mass, temperature and more),
*Why does Earth have seasons?*, *Why does the Moon have phases?*, *What happens in a solar
eclipse?*, *Voyager: the farthest journey* and *Voyager in detail* (the probe taken apart, its
power and radio, the gravity assists, the Golden Record and how to read its cover) - each scene
built to show the idea, every chapter read out by the narrator, and the pages turning by
themselves. Look around each scene: the Voyager probe and its record from all sides.

| | |
| --- | --- |
| ![The planets lesson: the Sun and the planets side by side at true scale](docs/images/lesson-planets.jpg) | ![The seasons lesson at the June solstice: Earth's axis tilted toward the Sun](docs/images/lesson-seasons.jpg) |
| ![The Moon phases lesson: the evening crescent seen from the ground](docs/images/lesson-moon.jpg) | ![The solar eclipse lesson: totality, the corona around the dark Moon](docs/images/lesson-eclipse.jpg) |
| ![The Voyager lesson: the probe with its antenna, booms and Golden Record named](docs/images/lesson-voyager.jpg) | ![The Golden Record, with what is on it](docs/images/lesson-record.jpg) |
| ![The Voyager lesson at Jupiter, 1979: both probes on their real paths, Voyager 1's photo of the Great Red Spot](docs/images/lesson-jupiter.jpg) | ![Voyager in detail: the probe taken apart, each part named](docs/images/lesson-taken-apart.jpg) |

And Apollo: *The Saturn V, taken apart* (the rocket to scale, its stack taken apart, each stage
cut open), *Columbia, inside and out* (the command and service module; inside, the Smithsonian's
3D scan of the real capsule, to walk through as the crew lay) and *Eagle, the lunar module*
(Project Apollo - NASSP's detailed model: the legs fold, the stages part, and inside you stand
where Armstrong and Aldrin stood, before every switch of the real panels) and *The Launch Tower and
the Crawler* (the Saturn V on its mobile launcher beside the umbilical tower, its swing arms, and the
crawler that carried it all to the pad).

| | |
| --- | --- |
| ![The Saturn V lesson: the first stage cut open, its tanks and five F-1 engines](docs/images/lesson-saturn-v.jpg) | ![Columbia's cabin, the Smithsonian's scan: the main display console over the couches](docs/images/lesson-columbia.jpg) |
| ![Eagle, the lunar module, in the blueprint room with a person for scale](docs/images/lesson-eagle.jpg) | ![Inside Eagle: the Commander's flight displays and the window](docs/images/lesson-eagle-cockpit.jpg) |
| ![The Saturn V on its mobile launcher beside the umbilical tower](docs/images/lesson-launcher.jpg) | ![The crawler-transporter carrying launcher, tower and rocket](docs/images/lesson-launcher-crawler.jpg) |

### Music

Three lo-fi tracks, played live by a synthesizer in the page (nothing recorded, nothing
downloaded): calm **Drift**, the lo-fi house of **Nova** and the 8-bit **Pixel**. The music steps
back while the narrator speaks.

![More, Audio tab: the narrator's voice, subtitles, and the music with its volume](docs/images/more.jpg)

### English and German

The whole app, the lessons and the narration, in English and German - asked on the first visit,
changeable in the settings.

### Private by design

No account, no tracking, no update check: the app loads only its own files, and your settings stay
in your browser.

- [Roadmap](docs/roadmap.md) — features named for future phases (seasons, moon phases, eclipses,
  satellites/probes, a speed-of-light calculator, gravitational field visualization, and more).
- [Changelog](CHANGELOG.md) — what's shipped so far.
- [Credits](CREDITS.md) — third-party data and library attributions.

To Boldly Glow is free software: you can redistribute it and/or modify it under the terms of the
[GNU General Public License](LICENSE) as published by the Free Software Foundation, either version 3
of the License, or (at your option) any later version. It is distributed in the hope that it will
be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
FOR A PARTICULAR PURPOSE. Releases up to 0.6.0 were published under the MIT License and stay
available under it.

Third-party images, data and fonts keep their own licenses (CC BY 4.0, public domain, CC0, SIL OFL
1.1 and others) - see [CREDITS.md](CREDITS.md). The app's About dialog (the info button at the top
right) lists them too, with their license texts and a link to this source code.

## For users

The quickest way to try it is the [live version](https://huepattl.de/products/to-boldly-glow).

### Run it from the download

1. Download `to-boldly-glow-<version>.zip` from the
   [project page](https://huepattl.de/products/to-boldly-glow) and unzip it.
2. Open `index.html` - double-click it, or drag it into a browser window.

That's all: no web server, no internet connection, nothing to install. It needs a browser with
WebGPU - see [Which browser?](#which-browser).

To run it from the source instead, or to work on it:

### Getting it running

1. Install [Node.js](https://nodejs.org/) 22.12 or later (`.nvmrc` pins the version CI uses).
2. Clone the repository and install dependencies:
   ```sh
   git clone https://github.com/bjblazko/to-boldly-glow.git
   cd to-boldly-glow
   npm install
   ```
3. Compile the orbital-mechanics engine (its WebAssembly build output isn't checked into git, so
   this is needed once, and again after pulling changes to `packages/engine`):
   ```sh
   npm run build --workspace=@toboldlyglow/engine
   ```
4. Start the app:
   ```sh
   npm run dev --workspace=@toboldlyglow/app
   ```
5. Open the printed local URL (usually `http://localhost:5173`) in a **WebGPU-capable browser** —
   see [Which browser?](#which-browser). There's no WebGL fallback: unsupported browsers will show a
   plain "unsupported browser" message instead of the scene.

### Using the app

- **The bar** — every control sits in one bar at the bottom: **Start**, **Search**, the camera,
  **Time**, **View** and **More**. In a lesson or a tour the same bar becomes its player, with
  **Leave** or **End tour**. Only one panel is open at a time; a press on the scene or Escape closes
  it.
- **Start** — the start page: explore on your own, the narrated **grand tour** (with its language
  and narrator), the two **Voyager tours** and the lessons with a search. It opens by itself on a
  first visit; nothing flies before a click, so the narrator is always heard.
- **Search** — `Ctrl+K` (`Cmd+K` on a Mac) or the bar's Search finds bodies, tours, lessons and
  settings in one list; a planet's name finds its moons too. Picking a body flies the camera to it
  and follows it; a "Following: …" chip above the bar lets go of it again.
- **Camera** — the camera key shows the mode in use and switches between the two. **Orbit**: drag
  to turn around the target, drag with two fingers (or the right mouse button, or Shift) to slide
  the view, scroll or pinch to zoom toward the pointer; the arrow keys turn and `W`/`S` zoom.
  Double-click (or double-tap) a planet, moon, comet or dwarf planet to fly there and follow it.
  **Free flight** is flown like a spaceship: `W`/`S` thrust forward/back, building up and dying away
  with weight; the arrow keys steer the nose (`↑` down, `↓` up, `←`/`→` turn); `Q`/`E` roll;
  `Shift` boosts; drag to look around, scroll to set the top speed. The ship slows near planets and
  stops at their surface. On a touch screen it shows a thumbstick and buttons. Switching shows the
  keys as keycaps (press `?` for them any time); a held key lights up.
- **Tours** — the grand tour flies from the Sun to Neptune and home to Earth with a narrator; the
  Voyager tours go station by station along the probes' real paths, each planet flyby at true scale,
  with the stations in the bar to jump between. Any camera input ends the grand tour.
- **Time** — the **Time** panel has play/pause, a reverse-direction button, and rate presets
  (real-time up to a year per second). The shuttle slider lets you dial in a rate directly: the
  center tick is zero (the clock is stopped), the left half rewinds, the right half fast-forwards
  — the fill color and the Past/Future labels show which side you're on. The panel also shows the
  current simulated date/time (UTC).
- **View** — what the scene shows: the **View** panel switches between **Realistic** (true-to-scale
  distances and sizes) and **Compact** (a compressed view that's easier to fly around in), and
  toggles planet orbits, comet and dwarf-planet orbits, name labels, the stars (in their real
  colors), the Milky Way (with its nebulae and the nearest galaxies), the asteroid and Kuiper belts,
  comets, Earth's clouds and moons independently.
- **More** — the settings, in tabs. **General**: the language. **Video**: HDR bloom, lens flares and the
  **Filmic look** (off by default), which renders the picture's colors like film (AgX tonemapping):
  the Sun burns out to white-hot instead of staying a saturated orange, and the sky goes deep black.
  **Audio**: the narrator's voice (Lyra or Orion) and whether it speaks, subtitles, and the music
  (off, Drift, Nova or Pixel) with its volume. Below them: show the controls, About (imprint,
  privacy, licenses) and hiding the interface (`H`).
- **Lessons** — on the start page, by topic, with a search; each remembers where you left it:
  **Get to know the planets** (the Sun and planets side by side at true scale, sorted by distance,
  size, mass, temperature and more, then each planet close up with its facts), **Why does Earth
  have seasons?** (Earth's tilted axis through a year), **Why does the Moon have phases?** (the
  Moon's orbit from above, then a month of evenings and mornings from the ground — crescent with
  earthshine, quarters and the rising full Moon), **What happens in a solar eclipse?** (the Moon's
  shadow from space, then the eclipse from the ground — through eclipse glasses, the diamond ring,
  totality and a ring of fire), **Voyager: the farthest journey** (the probes, the Golden Record,
  the flybys with NASA's photos, the Pale Blue Dot and interstellar space) and **Voyager in detail**
  (the probe taken apart, its power and radio, gravity assists, the heliopause and how to read the
  record's cover). Lessons play as they open, turning their pages by themselves; the bar steps
  through the chapters (the chapter counter lists them all to jump to), and the text card folds
  down to its title. Look around a scene as in Orbit - all the way round the Voyager probe and its
  record - and **Reset view** returns to the lesson's own.
- **Things to look for** — fly behind Earth (or the Moon) until it covers the Sun: the exposure
  opens up and the Sun's corona appears in full, with its streamers and the red prominences at the
  limb. Earth's night side shows its city lights, and the aurora glows around both poles — best seen
  at the limb, or looking down on a pole from the night side.

### Where the data and images come from

Everything shown is either real, openly licensed data or made for this project — no image or data
set is used without a license that allows it. In short (full attributions, file lists and license
texts are in [CREDITS.md](CREDITS.md)):

| What | Source | License |
| --- | --- | --- |
| Textures of the Sun, the planets, the Moon and Saturn's rings | [Solar System Scope](https://www.solarsystemscope.com/textures/) | CC BY 4.0 |
| Textures of Io, Europa, Ganymede, Callisto and Titan | NASA / JPL / USGS imagery (Voyager, Galileo, Cassini), via Wikimedia Commons | Public domain |
| Gas giants' bump maps | Derived from the Solar System Scope textures by `packages/data-pipeline` | CC BY 4.0 (inherited) |
| Planet positions | VSOP87 theory (Bureau des Longitudes), coefficients from the [astronomia](https://github.com/commenthol/astronomia) library | MIT |
| Rotation axes of the Sun and planets | IAU Working Group on Cartographic Coordinates and Rotational Elements (2015 report) | Published facts |
| Moon orbits | Published orbital elements (JPL/IAU) | Published facts |
| Stars: positions, brightness, colors (B−V) | [Yale Bright Star Catalogue, 5th ed.](https://cdsarc.cds.unistra.fr/ftp/V/50/) (Hoffleit & Warren, via CDS) | Public domain |
| Star colors from B−V | Formulas of Ballesteros (2012) and Kang et al. (2002) | Published formulas |
| Milky Way, nebulae, nearby galaxies | Painted procedurally for this project (`npm run paint-sky`); object positions from the NGC/IC, Sharpless and Lynds catalogs | Original, GPL-3.0-or-later |
| The Sun's limb darkening (per color) and granulation size and lifetime | Allen's Astrophysical Quantities; solar physics literature | Published facts |
| Comets, Ceres, Vesta, Pallas, Pluto | Orbital elements as published by the JPL Small-Body Database and the Minor Planet Center | Published facts |
| Asteroid and Kuiper belt populations | Generated from the populations' published statistics (no individual catalogued objects) | Original, GPL-3.0-or-later |
| Earth's clouds | Procedural, made for this project | Original, GPL-3.0-or-later |
| Earth's city lights | NASA Earth Observatory's "Earth at Night" 2012 (Black Marble; Suomi NPP VIIRS data, NOAA NGDC), from NASA WorldWind's npm package; lights extracted by `packages/data-pipeline` | Public domain |
| The Voyager spacecraft | NASA's "Voyager Probe (B)" model from [NASA 3D Resources](https://github.com/nasa/NASA-3D-Resources), converted by `packages/data-pipeline` (NASA's logotype painted over) | NASA media, no copyright |
| The Golden Record and the Voyager photos | NASA/JPL and NASA/JPL-Caltech, from NASA's Image and Video Library and Wikimedia Commons (the record's own pictures and music are not in the app) | Public domain |
| Voyager's paths, flybys and heliopause measurements | JPL Horizons; NASA's Space Physics Data Facility | Published data |
| Earth's aurora | Procedural; the ovals' place around the IGRF-14 geomagnetic poles and their published geomagnetic latitudes and heights | Original, GPL-3.0-or-later |
| The Sun's corona, chromosphere and prominences | Procedural; brightness profile from Baumbach's K-corona fit, heights from solar physics literature | Original, GPL-3.0-or-later |
| Apollo photos | NASA (HQ, MSFC, KSC, JSC), NASA Image and Video Library | Public domain |
| Saturn V, Columbia's outside, the cutaways | Our own models from NASA's and Grumman's published dimensions | Original, GPL-3.0-or-later |
| Columbia's cabin | Smithsonian National Air and Space Museum, 3D scan "Command Module Apollo 11: Interior" | CC0 |
| Eagle's outside and cockpit, the mobile launcher and the crawler | [Project Apollo - NASSP](https://github.com/orbiternassp/NASSP) (the Apollo add-on for Orbiter) | GPL-2.0-or-later |

## For developers

### Requirements

- Node.js 22.12 or later (`.nvmrc` pins the version CI uses; `npm install` at the repo root installs
  everything else, including AssemblyScript's `asc` compiler — no separate toolchain to set up).
- A WebGPU-capable browser (current Chrome/Edge) for running the app in dev mode and for the
  Playwright e2e suite. WebGPU-only is a deliberate MVP decision — see the "WebGL2 fallback" entry
  in [the roadmap](docs/roadmap.md) for the reasoning and what revisiting it would take.

### Project structure

This is an npm-workspaces monorepo with three packages:

- **`packages/engine`** — AssemblyScript. The pure numeric orbital-mechanics core (VSOP87
  planetary positions, Julian Day conversion, and similar), compiled to WebAssembly. Fully
  unit-testable without a browser or GPU.
- **`packages/app`** — TypeScript, built with Vite. This is the actual application. Its source is
  grouped by subject, not by technique — each feature keeps its shader, GPU pipeline, per-frame
  uniforms and draw call together:
  - `app/` starts everything and runs the frame loop; `scene/` decides each frame's *scene layout*
    (where every visible body is — the real solar system, or the active lesson's staged scene) and
    renders it.
  - `bodies/` (Sun, planets, moons, their surface materials and Earth's city lights), `sunCorona/`,
    `saturnRing/`, `atmosphereShell/`, `earthClouds/`, `earthAurora/`, `starfield/`, `sky/` (the
    Milky Way backdrop), `smallBodies/` (asteroid belts and comets on Keplerian orbits),
    `orbitPaths/`, `lensFlare/`, `bloom/`, `labels/` — one folder per thing you see.
  - `camera/` (orbit, free flight and their input in `camera/input/`, follow, the tour in
    `camera/tour/`), `learn/` (lessons, with
    `seasons/`, `sizes/`, `eclipse/`, `phases/` and the shared sky and horizon in `ground/`), `hud/`,
    `time/`, `search/`, `solarSystem/` (body data and
    orbital mechanics), `narration/` (the narrator: scripts, clips, subtitles), `tours/` (the Tours
    mode), `music/` (the live synthesizer and its tracks) and `i18n/` (English and German texts).
  - `gpu/` and `lines/` hold the WebGPU plumbing the features share.
- **`packages/data-pipeline`** — TypeScript. Offline conversion scripts (e.g. turning the Yale
  Bright Star Catalogue into the binary starfield asset `packages/app` loads at runtime,
  painting the Milky Way panorama, `npm run paint-sky`, and pulling Earth's city lights out of
  NASA's night image, `npm run extract-city-lights`), and the narration: the narrator's clips are
  spoken locally by Qwen3-TTS (`npm run narrate`, Python; see `packages/data-pipeline/narration/`).
  Not part of the normal dev loop — only run when source data changes.

### Setup

```sh
git clone https://github.com/bjblazko/to-boldly-glow.git
cd to-boldly-glow
npm install
npm run build --workspace=@toboldlyglow/engine   # compiles the WASM engine (build/ is gitignored)
npm run dev --workspace=@toboldlyglow/app        # Vite dev server with hot reload
```

### Common tasks

Run from the repo root:

| Command | What it does |
| --- | --- |
| `npm run dev --workspace=@toboldlyglow/app` | Dev server with hot reload |
| `npm run build` | Builds the engine, then the app, for production |
| `npm run build:offline --workspace=@toboldlyglow/app` | Builds the download that runs from the disk, and zips it (`packages/app/dist-offline/`) |
| `npm test` | Unit tests across all three packages (Vitest) |
| `npm run test:e2e` | Builds the app, then runs the Playwright e2e suite in a real browser |
| `npm run typecheck` | `tsc --noEmit` for the app, its unit tests and e2e specs |
| `npm run lint` | ESLint across the whole repo, including type-aware rules and clean-code limits |

Production code is held to clean-code limits by ESLint (see `eslint.config.js`): cyclomatic
complexity at most 8, functions at most 40 lines and 15 statements, at most 4 parameters, nesting at
most 3 deep, files at most 300 lines. When a function outgrows them, split it along what it does.

### Documentation

- [MVP Design Specification](docs/superpowers/specs/2026-07-17-to-boldly-glow-mvp-design.md) — the
  current, implementation-ready design.
- [Roadmap](docs/roadmap.md) — deferred features, each with just enough detail to pick up later.
- [Changelog](CHANGELOG.md) — what's shipped, in [Keep a Changelog](https://keepachangelog.com/)
  format.
- [Credits](CREDITS.md) — data and library attributions; check here before adding new third-party
  data or assets, and add to it when you do.
