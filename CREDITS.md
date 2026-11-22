# Credits & Data Sources

To Boldly Glow builds on the work of the following open, public-domain, and openly-licensed
projects. Thank you.

## Planetary position data (VSOP87)

Earth's heliocentric position (`packages/engine/assembly/data/vsop87Earth.ts`) is a truncated
(largest-amplitude terms only) derivation of the VSOP87 planetary theory, originally published by
the Bureau des Longitudes (P. Bretagnon, J.-L. Simon, and collaborators). The specific coefficient
values were sourced from the **astronomia** JavaScript library
(https://github.com/commenthol/astronomia) by commenthol and contributors, MIT licensed:

```
MIT License
Copyright (c) astronomia contributors
https://github.com/commenthol/astronomia/blob/master/LICENSE
```

The truncation (keeping the largest-amplitude periodic terms per order) and its accuracy bounds
(under 1 arcsecond in longitude/latitude, under 200 km in distance, over the year range
1800–2200) were derived and verified specifically for this project; see
`docs/superpowers/plans/2026-07-17-orbital-mechanics-earth.md` for the verification method.

The evaluation method (summing periodic terms as a power series in Julian millennia since J2000.0)
follows the standard VSOP87 usage described in Jean Meeus, *Astronomical Algorithms*, 2nd ed.
(Willmann-Bell, 1998).

The same source and methodology were used for the remaining 7 planets (Mercury, Venus, Mars,
Jupiter, Saturn, Uranus, Neptune) — see
`docs/superpowers/plans/2026-07-18-remaining-planets-orbital-mechanics.md` for the accuracy target
and cross-verification used for those bodies (looser than Earth's, deliberately, since it is
visually indistinguishable at any reasonable camera distance and keeps the combined dataset
smaller).

## Axial tilt & orbital-plane orientation

Each body's real rotation-axis direction (`poleRightAscensionDegrees`/`poleDeclinationDegrees` in
`packages/app/src/solarSystem/bodies.ts`) is sourced from the IAU Working Group on Cartographic
Coordinates and Rotational Elements (WGCCRE), the standard reference for planetary pole
orientations:

```
Archinal, B.A., Acton, C.H., A'Hearn, M.F. et al.
"Report of the IAU Working Group on Cartographic Coordinates and Rotational Elements: 2015."
Celestial Mechanics and Dynamical Astronomy 130, 22 (2018).
https://doi.org/10.1007/s10569-017-9805-5
```

Each moon's orbital-plane inclination relative to its parent's equator
(`orbitInclinationToParentEquatorDegrees`/`orbitAscendingNodeDegrees` in
`packages/app/src/solarSystem/moons.ts`) is sourced from Wikipedia's orbital-elements infoboxes for
each moon (themselves derived from JPL/IAU data), cross-checked at time of writing. Triton's
inclination is a representative snapshot value, not a precise unchanging constant — its real
orbital node precesses with a ~678-year period, which this app does not model (see
`docs/superpowers/specs/2026-07-19-axial-tilt-design.md`).

## Planet & Sun textures

The 2K equirectangular albedo textures for the Sun and all 8 planets
(`packages/app/public/textures/*.jpg`) are sourced from
[Solar System Scope](https://www.solarsystemscope.com/textures/), licensed under
**Creative Commons Attribution 4.0 International (CC BY 4.0)**:

```
Textures by Solar System Scope (https://www.solarsystemscope.com/textures/)
License: Attribution 4.0 International (CC BY 4.0)
https://creativecommons.org/licenses/by/4.0/
```

Files used: `2k_sun.jpg`, `2k_mercury.jpg`, `2k_venus_surface.jpg`, `2k_earth_daymap.jpg`,
`2k_mars.jpg`, `2k_jupiter.jpg`, `2k_saturn.jpg`, `2k_uranus.jpg`, `2k_neptune.jpg`, renamed to
`<body-id>.jpg` in this repo. Saturn's ring texture (`packages/app/public/textures/saturn_ring.png`,
a radial gradient/alpha strip) is `2k_saturn_ring_alpha.png` from the same source and license.

## Moon textures

The Moon's texture (`packages/app/public/textures/moon.jpg`, `2k_moon.jpg`) is also from Solar
System Scope, same source/license as above.

The Galilean moons (Io, Europa, Ganymede, Callisto) and Titan use public-domain NASA/JPL/USGS
imagery, sourced via Wikimedia Commons (each confirmed "Public domain" under `{{PD-USGov-NASA}}`
or equivalent at time of download) and resized/recompressed for this repo:

```
Io      — packages/app/public/textures/io.jpg
          Source: NASA/JPL/USGS, "Io map projection" (PIA00319)
          https://photojournal.jpl.nasa.gov/catalog/PIA00319

Europa  — packages/app/public/textures/europa.jpg
          Source: USGS/PDS/Tammy Becker, Voyager-Galileo SSI global mosaic
          https://astrogeology.usgs.gov/search/map/Europa/Voyager-Galileo/Europa_Voyager_GalileoSSI_global_mosaic_500m

Ganymede — packages/app/public/textures/ganymede.jpg
          Source: Caltech/JPL/USGS, Voyager global map
          https://maps.jpl.nasa.gov/pix/jup3vss2.jpg

Callisto — packages/app/public/textures/callisto.jpg
          Source: USGS, equatorial map mosaic
          https://geopubs.wr.usgs.gov/i-map/i2770/

Titan   — packages/app/public/textures/titan.jpg
          Source: NASA, Cassini-derived global map (PIA14908)
          https://photojournal.jpl.nasa.gov/catalog/PIA14908
```

Titania, Oberon, and Triton have no texture (they render as a flat, illustrative-color sphere
instead) — Voyager 2's brief flybys of Uranus and Neptune only imaged part of each moon's surface,
leaving large gaps in any full-sphere equirectangular projection of them; no gap-free public-domain
map exists to source instead.

## Bump/height maps

Jupiter/Saturn/Uranus/Neptune's bump maps
(`packages/app/public/textures/{jupiter,saturn,uranus,neptune}_bump.png`) are **not real elevation
data** — no such data exists for gas-giant cloud tops. They're synthetically derived from each
planet's own already-licensed color texture (luminance + contrast enhancement, via
`packages/data-pipeline/src/deriveGasGiantBumpMaps.ts`), inheriting the same Solar System Scope CC
BY 4.0 license as the source textures. A stylization for visual depth, not a scientific claim.

## Star catalog

The starfield's positions and brightness (`packages/app/public/stars/starCatalog.bin`) are
converted from the **Yale Bright Star Catalogue, 5th Revised Edition** (Hoffleit & Warren, Yale
University Observatory / Astronomical Data Center), a public-domain catalog of all ~9,100 stars
down to naked-eye visibility (V ≤ 6.5):

```
V/50  Bright Star Catalogue, 5th Revised Ed. (Preliminary Version)
Hoffleit D., Warren Jr W.H., Astronomical Data Center, NSSDC/ADC (1991)
Source used: CDS VizieR ASCII edition, https://cdsarc.cds.unistra.fr/ftp/V/50/catalog.gz
```

The raw catalog and its byte-by-byte format description are vendored at
`packages/data-pipeline/data/bsc5.dat` and `packages/data-pipeline/data/ReadMe`. Conversion (RA/Dec
→ a direction in the scene's ecliptic frame; visual magnitude and B−V color index passed through)
happens once, offline, via `packages/data-pipeline` (`npm run convert`), not at runtime. The
equatorial-to-galactic rotation used for the sky painting is the Hipparcos catalogue's (ESA 1997,
vol. 1, §1.5.3) and is checked against the catalog's own galactic coordinates.

Star colors: B−V is turned into a blackbody temperature with the formula of Ballesteros
(*EPL* 97, 34008, 2012), and the temperature into a color via the Planckian-locus approximation of
Kang et al. (*Journal of the Korean Physical Society* 41, 865, 2002) and the standard CIE XYZ to
sRGB matrix.

## The Sun's surface

Limb darkening (`packages/app/src/bodies/sunShader.ts`) uses the quadratic law
I(μ)/I(1) = 1 − u(1 − μ) − v(1 − μ²) with the coefficients u and v tabulated for the Sun in
*Allen's Astrophysical Quantities* (A. N. Cox, ed., 4th ed., Springer 2000), at 450, 550 and
650 nm for the blue, green and red channels. The granulation's cell size (~1,300 km), lifetime
(~10 minutes) and rms contrast (~12% in white light) are typical published values; the pattern
itself is procedural (a Worley noise), not an observation.

## The Sun's corona

The corona (`packages/app/src/sunCorona/`) is procedural, made for this project. Its radial
brightness follows C. Baumbach's fit of the K corona, I(r) ∝ 0.0532 r^−2.5 + 1.425 r^−7 +
2.565 r^−17 (r in solar radii; *Astronomische Nachrichten* 263, 121, 1937), with its dynamic range
compressed the way eclipse photographs are processed. The helmet streamers, rays and prominences are
placed by a seeded random generator, with sizes typical of published observations (prominences
20,000-100,000 km high, a chromosphere about 2,000 km deep); none is a particular observed feature.

## Earth at night

Earth's city lights (`packages/app/public/textures/earth_night.png`) are extracted from NASA Earth
Observatory's "Earth at Night" 2012 (the Black Marble), by `packages/data-pipeline/src/extractCityLights.ts`.
The source image is NASA's, public domain:

```
NASA Earth Observatory image by Robert Simmon, using Suomi National Polar-orbiting Partnership
(Suomi NPP) VIIRS data provided courtesy of Chris Elvidge (NOAA National Geophysical Data Center).
https://earthobservatory.nasa.gov/images/79765/night-lights-2012-map
```

It was taken from NASA WorldWind's npm package, `@nasaworldwind/worldwind` 0.11.1 (Apache 2.0 for
its code; the image is NASA's), file `build/dist/images/dnb_land_ocean_ice_2012.png` (2048x1024,
SHA-256 `c1893c1a97634f9d9dc45a62f83916c77cae742d5128551f8d7c4e4f5296ed36`). The extraction removes
the image's blue rendering of land, ocean and ice and keeps only the lights.

The aurora (`packages/app/src/earthAurora/`) is procedural, made for this project. The ovals ring the
2025 geomagnetic poles of the IGRF-14 field model (80.8°N, 72.6°W and the opposite point) at about
67° geomagnetic latitude around midnight and 75° around noon, with oxygen's green emission from
about 95 km up and its red emission around 250 km - typical published values.

## Voyager: model, photos, trajectories and measurements

The Voyager lessons' spacecraft (`packages/app/public/models/voyager/voyager.*`,
`voyager-color.jpg`, `voyager-grey.jpg`) is NASA's "Voyager Probe (B)" model from
[NASA 3D Resources](https://github.com/nasa/NASA-3D-Resources) (`3D Models/Voyager Probe (B)/Voyager
Probe (B).glb`, SHA-256 `bd86ded828dd3f459293aee4ffc3cd0998d8db67439317c8299650a1174c3289`, vendored at
`packages/data-pipeline/data/voyager/voyager.glb`), NASA material without copyright under the
[NASA Images and Media Usage Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/).
`packages/data-pipeline/src/convertVoyager.ts` converts it (decoding Draco with gltf-transform and
draco3dgltf, build-time only), splits it into its main assemblies, and paints over a sticker with
NASA's "worm" logotype in its texture: NASA's insignia and logotypes are not in the public domain.

The Golden Record's textures (`record-cover.jpg`, `record-label.jpg`) are cropped from NASA/JPL's
photos "The Sounds of Earth Record Cover" (GPN-2000-001978, SHA-256 `89f8666e...6055cff`) and
"The Sounds of Earth" (GPN-2000-001976, SHA-256 `d4a2750d...b8344952`), public domain, via Wikimedia
Commons. The record's 115 images and its music are third-party copyright and are **not** in the app;
the lesson links to NASA's page instead.

The photos (`packages/app/public/images/voyager/`) are from NASA's Image and Video Library, resized by
`packages/data-pipeline/src/fetchVoyagerPhotos.ts`: PIA21747 (Voyager 1 launch, NASA/JPL-Caltech/KSC),
PIA21744 (Voyager 2 launch, NASA/JPL-Caltech), PIA01384 (Jupiter), PIA00379 (Io's eruptions),
PIA00459 (Europa), PIA01383 and PIA00024 (Saturn), PIA01486 (Saturn's rings), PIA00042 (Miranda),
PIA01492 (Neptune), PIA02246 (Triton) - all NASA/JPL - and PIA18182 (Uranus) and PIA23645 (Pale
Blue Dot Revisited), NASA/JPL-Caltech.

The trajectories (`packages/app/public/data/voyager/voyager{1,2}.trajectory.bin`, `speeds.json`) come
from JPL Horizons (`packages/data-pipeline/src/fetchVoyagerTrajectories.ts`):

```
Giorgini, JD and JPL Solar System Dynamics Group, NASA/JPL Horizons On-Line Ephemeris System,
https://ssd.jpl.nasa.gov/horizons/, data retrieved 2026-Nov-15.
```

The flybys at true scale (`packages/app/public/data/voyager/encounters/`) are Horizons vectors of
each probe and one moon relative to the planet's centre, every 5 minutes for 36 hours either side of
closest approach (`packages/data-pipeline/src/fetchVoyagerEncounters.ts`), same source and citation.

The heliopause measurements (`packages/app/public/data/voyager/heliopause-voyager{1,2}.json`) are
extracted by `packages/data-pipeline/src/extractHeliopauseData.ts` from NASA's Space Physics Data
Facility merged daily data (https://spdf.gsfc.nasa.gov/pub/data/voyager/voyager1/merged/voyager1_daily.asc,
SHA-256 `b3804c2795861bc02f635491e6f1d716cf10bee883f1d7243dd75a2094eed106`, and
https://spdf.gsfc.nasa.gov/pub/data/voyager/voyager2/merged/voyager2_daily.asc, SHA-256
`2b7963fc16e390cfb74f87d71fd69fd3ce8041c544954a5ded8840d08a186c75`): the Cosmic Ray
Subsystem's 3.0-4.6 MeV protons and the magnetometer's field strength. With thanks to SPDF and the
instruments' teams (CRS: E. C. Stone et al.; MAG: N. F. Ness, L. F. Burlaga et al.), as SPDF asks.

## Apollo: the Saturn V

The Saturn V lesson's rocket (`packages/app/public/models/saturnV/`) is our own model, built by
`packages/data-pipeline/src/buildSaturnV.ts` from the rocket's dimensions; nothing is downloaded and
no third-party model is used. Its sources, all NASA and public domain:

- the "Saturn V News Reference" (NASA Marshall Space Flight Center, December 1968,
  https://archive.org/details/saturn-v-news-reference): stage sizes, tanks, engines, flows;
- the "Saturn V Flight Manual SA-506" (https://archive.org/details/saturn-5-flight-manual-sa-506):
  the fin span and the separation planes' vehicle stations, which give the interstages' lengths;
- the "Saturn V Launch Vehicle Flight Evaluation Report AS-506" (MPR-SAT-FE-69-9,
  https://archive.org/details/saturn-v-launch-vehicle-flight-evaluation-report-as-506): Apollo 11's
  mass at ignition (2,938,315 kg), its burn times, the altitude at S-IC/S-II separation and the speed
  after trans-lunar injection;
- the "Apollo 11 Mission Report" (MSC-00171, https://archive.org/details/apollo-11-mission-report):
  the command module's mass at landing (10,873 lb);
- "Stages to Saturn" (NASA SP-4206, https://archive.org/details/stagestosaturnte00bilsrich): the
  S-IVB as an improved S-IV.

Measures none of them settle (the spacecraft-LM adapter, the escape tower, the S-IVB's tank
lengths, the fins' shape) are approximations from common published figures, marked `APPROX` in
`apollo/saturnVProfile.ts`. The paint is drawn from photos of the rocket; it carries the US flag
(public domain) and no NASA insignia.

The photos (`packages/app/public/images/apollo/`) are from NASA's Image and Video Library, resized
by `packages/data-pipeline/src/fetchSaturnVPhotos.ts`, each caption checked for a non-NASA credit:
6901000 (Apollo 11 launch), 9903405 (an F-1 engine), 6758331 (an S-II stacked, Apollo 6),
6861994 (an S-IVB on its test stand, Apollo 10) and 0100806 (Instrument Unit chart), NASA/MSFC; and
KSC-69P-372 (Apollo 11 rollout), NASA/KSC. The Columbia lesson's photos, fetched the same way by
`packages/data-pipeline/src/fetchColumbiaPhotos.ts`: 372772main_GPN-2000-001212_full (Columbia after
splashdown, NASA), S69-40758 (Columbia aboard the USS Hornet) and S69-38317 (Michael Collins in the
command module simulator), NASA/JSC.
The Eagle lesson's photos, fetched the same way by `packages/data-pipeline/src/fetchEaglePhotos.ts`,
NASA/JSC, public domain (captions checked: no other credit): as11-40-5927 (Eagle on the Moon, Aldrin
beside it), as11-44-6581 (Eagle in lunar orbit), as11-40-5863 (Aldrin leaving through the hatch) and
as11-44-6642 (the ascent stage at rendezvous).
The Apollo 11 lesson's own photos, fetched the same way by
`packages/data-pipeline/src/fetchApollo11Photos.ts`, NASA, public domain (captions checked: no other
credit): Marshall's sketches of July 1969 of the transposition and docking (6902077) and of the
liftoff from the Moon and the rendezvous (6902073), NASA/MSFC; the ground beside Eagle through its
window (as11-37-5458) and the ascent stage coming up to Columbia (as11-44-6626), NASA/JSC.

## Apollo: Columbia, the command and service module

The spacecraft's outside (`packages/app/public/models/columbia/csm.*`, `csm-palette.png`) is our own
model, built by `packages/data-pipeline/src/buildColumbia.ts` from the dimensions and layout in North
American Rockwell's "Apollo Spacecraft News Reference" for NASA (1968, public domain,
https://archive.org/details/apollo-spacecraft-news-reference-1968): the command and service
modules' sizes, the service module's six sectors and what each holds, its tanks, fuel cells and
engine. Measures it does not settle are marked `APPROX` in `apollo/csmProfile.ts`.

The cabin (`packages/app/public/models/columbia/cabin.*`, `cabin-*.jpg`) is the Smithsonian
National Air and Space Museum's 3D scan "Command Module Apollo 11: Interior"
(https://3d.si.edu/object/3d/command-module-apollo-11:d8c63e8a-4ebc-11ea-b77f-2e728ce88125), released
under CC0 1.0 (checked on the item page, 2026-11-20): the medium-resolution glb
(`apollo_interior-medium_resolution.glb`, SHA-256
`0041357eccea177fa28023a97ae400b6f45bddcf635b0ad57840315b71089b50`), simplified with meshoptimizer to
about half its triangles, its textures resized, moved into our command module's frame. The writing
inside - the crew's notes on the walls - is part of the scanned object.

## Apollo: Eagle, the lunar module

Eagle's outside and cockpit (`packages/app/public/models/eagle/`: `lm.*`, `cockpit.*` and
`nassp/`) are converted from Project Apollo - NASSP's lunar module
(https://github.com/orbiternassp/NASSP, the Apollo add-on for the Orbiter space flight simulator),
GNU General Public License, version 2 or later (`packages/app/public/licenses/nassp.txt`), used here
under version 3 or later with the rest of To Boldly Glow. "Or later": NASSP's source files say so in
their notices ("either version 2 of the License, or (at your option) any later version", e.g.
`Orbitersdk/samples/ProjectApollo/src_lm/lemmesh.cpp`); its mesh and texture files carry no notice
of their own, and where no version is stated GPLv2 section 9 lets the recipient choose any. Converted
in November 2026 by To Boldly Glow. Source files, at commit
`ddba501d2e274367b8660d7050dee7b9f4153865`: `Meshes/ProjectApollo/LM_DescentStage.msh`,
`LM_AscentStage.msh`, `LM_VC.msh` and the textures they name under `Textures/ProjectApollo/`.
`packages/data-pipeline/src/buildEagle.ts` downloads them at that commit and converts them: into our
frame (Orbiter's is left-handed), split into the lesson's parts with the legs' hinges, the ascent
stage's rough cabin left out (the cockpit model replaces it), the DDS textures decoded, resized and
saved as JPEG.

What the cutaway shows inside the stages - the descent stage's four tanks and engine, the ascent
stage's two tanks and engine - and the person for scale (`lm-palette.png`) are our own, built from
the dimensions in Grumman's "Apollo Lunar Module News Reference" for NASA (1968, public domain,
https://archive.org/details/apollo-lunar-module-news-reference-1968); measures it does not settle
are marked `APPROX` in `apollo/lmProfile.ts`. The lesson's figures come from the same document.

## Apollo 11: the timeline and the path to the Moon

Apollo 11's events in mission time (`packages/app/src/missions/apollo11/apollo11Events.ts`) and the
documented states its path is reconstructed from and checked against come from Richard W. Orloff's
"Apollo by the Numbers" (NASA SP-4029, 2000; https://archive.org/details/apollo-by-the-numbers) and
NASA's "Apollo 11 Mission Report" (MSC-00171, 1969; https://archive.org/details/apollo-11-mission-report),
both public domain. The path (`packages/app/public/data/apollo11/translunar.bin`, `transearth.bin`) is our own
reconstruction by `packages/data-pipeline/src/buildApollo11Trajectory.ts`; the Moon's and the Sun's
positions it is integrated in (`data/apollo11-ephemeris.json`, and `public/data/apollo11/moon.bin`)
are from NASA/JPL Horizons (DE441).

## Tonemapping

The tonemapping (`packages/app/src/bloom/tonemapWgsl.ts`) follows Troy Sobotka's AgX view
transform, using the inset/outset matrices and the polynomial fit of its contrast curve published
by Benjamin Wrensch ("Minimal AgX Implementation", iolite engine blog, 2023). The shader code is
written for this project.

## Milky Way and deep-sky backdrop

The Milky Way panorama (`packages/app/public/sky/milkyWay.jpg`) is an original procedural painting
made for this project by `packages/data-pipeline/src/paintMilkyWay.ts` - not a photograph, so it
carries no third-party license. The positions of the nebulae, dark clouds and galaxies painted into
it are their published J2000 coordinates (NGC/IC, Sharpless and Lynds catalogs); their shapes,
sizes and brightnesses are artistic.

## Comets, dwarf planets and asteroids

The orbital elements of the named comets, dwarf planets and asteroids
(`packages/app/src/smallBodies/smallBodyCatalog.ts`) are rounded osculating elements as published
by the JPL Small-Body Database and the IAU Minor Planet Center (facts, not copyrightable). The
asteroid and Kuiper belt populations are generated from the general statistics of those populations
(semi-major axis ranges, the Kirkwood gaps, the 3:2 resonances of the Hildas and plutinos, the
Trojans' L4/L5 swarms); no individual catalogued object is implied.

## Narration voice

The narrated tour's voice (`packages/app/public/narration/`, Opus and MP3) is synthetic: it was spoken by
**Qwen3-TTS** (https://github.com/QwenLM/Qwen3-TTS) by the Qwen team, Alibaba Cloud, code and
model weights Apache-2.0 (`Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign` designed the two narrators, Lyra
and Orion, from a written description, once per language - they imitate no real person - and
`Qwen/Qwen3-TTS-12Hz-0.6B-Base` spoke every clip in their voices). It ran locally at build time (`packages/data-pipeline/narration/`); neither the model nor
its Python dependencies ship with the app - only the audio, encoded with libopus and LAME (via
FFmpeg). The
narration texts were written for this project, from NASA's Planetary Fact Sheets and planet pages.

## Fonts

- [Inter Tight](https://github.com/rsms/inter-tight) — © 2022 The Inter Project Authors, SIL Open
  Font License 1.1 (the HUD and the labels in the scene)
- [IBM Plex Mono](https://github.com/IBM/plex) — © 2017 IBM Corp., SIL Open Font License 1.1
  (readouts)

Both are bundled from the [Fontsource](https://fontsource.org/) packages, not loaded from a font
service at run time.

## Math library

- [gl-matrix](https://glmatrix.net/) — MIT License (matrix/vector math for the WebGPU renderer:
  perspective/lookAt matrices, vector normalization)

## Built into the app by the build

- [AssemblyScript](https://www.assemblyscript.org/) — Apache License 2.0. Compiles the orbit
  engine to WebAssembly; its runtime and standard library end up inside `engine.wasm`, so its
  license and NOTICE ship with the app.
- [Rolldown](https://rolldown.rs/) (Vite's bundler) — MIT License. A few lines of its module
  runtime end up in the bundle.

## License texts in the app

Every license text the built app needs travels with it in `packages/app/public/licenses/`, copied
from the exact installed versions; the About dialog (the info button at the top right) links them.
`packages/app/test/credits.test.ts` fails when a runtime package or a file in `public/` has no
entry in `packages/app/src/about/credits.ts`, or a shipped text differs from the installed one.

## Build tooling
- [gltf-transform](https://gltf-transform.dev/) — MIT License, and [draco3dgltf](https://github.com/google/draco) — Apache License 2.0 (decoding NASA's Voyager model in the data pipeline; not shipped)
- [Vite](https://vitejs.dev/) — MIT License
- [Vitest](https://vitest.dev/) — MIT License
- [Playwright](https://playwright.dev/) — Apache License 2.0
