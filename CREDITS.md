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

## Math library

- [gl-matrix](https://glmatrix.net/) — MIT License (matrix/vector math for the WebGPU renderer:
  perspective/lookAt matrices, vector normalization)

## Build tooling

- [AssemblyScript](https://www.assemblyscript.org/) — MIT License
- [Vite](https://vitejs.dev/) — MIT License
- [Vitest](https://vitest.dev/) — MIT License
- [Playwright](https://playwright.dev/) — Apache License 2.0
