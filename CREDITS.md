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

## Tonemapping

The "Filmic look" (`packages/app/src/bloom/tonemapWgsl.ts`) follows Troy Sobotka's AgX view
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

## Build tooling

- [AssemblyScript](https://www.assemblyscript.org/) — MIT License
- [Vite](https://vitejs.dev/) — MIT License
- [Vitest](https://vitest.dev/) — MIT License
- [Playwright](https://playwright.dev/) — Apache License 2.0
