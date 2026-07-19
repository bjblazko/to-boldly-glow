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
→ unit direction, magnitude → render brightness) happens once, offline, via
`packages/data-pipeline` (`npm run convert`), not at runtime.

## Math library

- [gl-matrix](https://glmatrix.net/) — MIT License (matrix/vector math for the WebGPU renderer:
  perspective/lookAt matrices, vector normalization)

## Build tooling

- [AssemblyScript](https://www.assemblyscript.org/) — MIT License
- [Vite](https://vitejs.dev/) — MIT License
- [Vitest](https://vitest.dev/) — MIT License
- [Playwright](https://playwright.dev/) — Apache License 2.0
