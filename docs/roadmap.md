# To Boldly Glow — Roadmap

Companion to [the MVP design spec](superpowers/specs/2026-07-17-to-boldly-glow-mvp-design.md).
Each entry here is a named future feature with just enough detail to pick up later without
re-deriving requirements from scratch. Before implementation, each entry should go through its own
brainstorming → design-spec → implementation-plan cycle.

## Earth seasons visualization
**What**: Show why Earth has seasons — axial tilt (23.4°) relative to orbital plane, and how
sunlight angle/duration changes through the year at a chosen latitude.
**Approach**: Animate Earth's tilt and orbit over a compressed year, with a marker for the
observer's chosen latitude and a sun-angle indicator; sync to the main time controller.
**Data needed**: none beyond what MVP already has (Earth's orbital elements, axial tilt constant).

## Moon phase / cycle deep-dive
**What**: Explain the ~29.5-day synodic lunar cycle — why we see phases, the difference between
sidereal and synodic month, supermoon/perigee-syzygy.
**Approach**: A dedicated view showing Sun–Earth–Moon geometry from above alongside the phase as
seen from Earth, scrubbable via the shared time controller.
**Data needed**: ELP2000 lunar position (already in `packages/engine` for MVP) — mostly a new UI
view, not new data.

## Solar & lunar eclipses
**What**: Visualize and explain solar/lunar eclipse geometry (umbra/penumbra, why eclipses don't
happen every month due to orbital plane inclination), and let the user jump to real historical/
future eclipse dates.
**Approach**: Extend the Moon phase view with penumbra/umbra shadow cones; a searchable list of
eclipse dates for a given date range.
**Data needed**: eclipse date tables (e.g. NASA's public-domain eclipse catalogs) bundled or
computed from the existing orbital elements.

## ISS and notable satellites
**What**: Real-time-ish position of the ISS and a curated set of notable satellites.
**Approach**: TLE (Two-Line Element) orbit propagation (SGP4 algorithm) added to `packages/engine`;
TLE data fetched periodically online when available, with a bundled last-known-good snapshot for
offline use.
**Data needed**: TLE data from Celestrak (freely republishable) or space-track.org; SGP4 propagator
(public algorithm, needs a clean-room or openly-licensed implementation to keep to MIT).

## Probes and comets
**What**: Positions of interplanetary probes (Voyager 1/2, etc.) and notable comets.
**Approach**: For probes beyond Earth orbit, use NASA JPL Horizons ephemeris data (freely
available; check API/bulk-data terms before bundling) rather than SGP4. Comets via published
orbital elements (e.g. from the Minor Planet Center, checking license/reuse terms).
**Data needed**: JPL Horizons ephemerides or orbital elements; needs a licensing check pass before
committing to a specific source, per the project's data-provenance discipline (§5 of the MVP spec).

## Speed-of-light / travel-time calculator
**What**: A standalone tool: pick two points (e.g. Earth–Moon, Earth–Mars, Earth–nearest star) and
a speed (walking, car, plane, light-speed, or a custom value), see how long the trip would take.
**Approach**: A separate UI panel/tool reusing the engine's distance calculations; no new renderer
work required, mostly UI + arithmetic.
**Data needed**: none beyond existing body positions/distances.

## Gravitational field visualization
**What**: Visualize gravitational potential/field lines around bodies, and how they combine (e.g.
Lagrange points, why orbits are stable).
**Approach**: Likely a shader-based field-line or potential-well visualization layered on the
existing renderer; may need compute shaders (a natural fit for the WebGPU-only decision in the MVP
spec).
**Data needed**: none beyond existing masses/positions — this is a rendering/pedagogy challenge,
not a data problem.

## Kuiper Belt, apogee/perigee, TLI explainer content
**What**: Visual + explanatory content for concepts mentioned but not covered in MVP: the Kuiper
Belt (as a rendered belt of small bodies), apogee/perigee (orbital extremes), and TLI (trans-lunar
injection, i.e. how missions actually get from Earth orbit to the Moon).
**Approach**: Kuiper Belt as a procedurally-scattered point cloud (not individual real objects,
given the population size); apogee/perigee and TLI as annotated overlays on existing orbit-path
rendering.
**Data needed**: none beyond existing orbital mechanics — mostly content-authoring + a rendering
pass.

## Named star search
**What**: Extend the entity search (Sun/planets/moons, with camera fly-to and orbit-follow lock-on)
to also cover named stars from the starfield catalog, e.g. Sirius, Betelgeuse, Polaris.
**Approach**: Reuses the search UI and camera-follow machinery built for Sun/planets/moons — search
just needs star entries added to the searchable index. Camera-follow semantics need their own design
pass first, though: stars are rendered as a fixed backdrop (point sprites with no real navigable 3D
position at solar-system scale), so "flying to" one doesn't mean the same thing as flying to a
planet — more likely just re-aiming the view direction at it, with no distance/zoom change.
**Data needed**: proper star names, which don't exist anywhere in the pipeline today. The raw Yale
Bright Star Catalogue source only carries Bayer/Flamsteed designations (e.g. Sirius is stored as
`9Alp CMa`), and the bundled `starCatalog.bin` asset (`packages/data-pipeline/src/convertBrightStarCatalog.ts`
→ `packages/app/src/starfield/starCatalog.ts`) carries only position + brightness, no identifiers at
all. Needs a supplementary named-star dataset (e.g. the IAU Catalog of Star Names) joined in by HR
number, plus a licensing check per the project's data-provenance discipline (§5 of the MVP spec).

## Mobile/touch refinement
**What**: MVP includes basic touch gestures (drag-to-orbit, pinch-to-zoom); this entry covers
deeper mobile ergonomics — layout adaptation for small screens, touch-friendly HUD sizing,
performance tuning for mobile GPUs.
**Approach**: Responsive layout pass on the existing DOM-based UI; profiling on representative
mobile hardware.
**Data needed**: none.

## Planet texture mipmaps
**What**: The 2K equirectangular planet/Sun textures added for the eye-candy pass ship without
mipmaps. Small/distant spheres (especially at the "Explorer" end of the scale slider) may alias or
shimmer under minification without them.
**Approach**: Generate a mip chain per texture at load time via a manual blit-downsample render
pass per level (`mipLevelCount` + repeated fullscreen-quad draws into successive mip views) — a
well-known WebGPU pattern. The bloom pass's downsample-chain shader (dual-Kawase-style fullscreen
blit) is structurally similar, so this could reuse that code path rather than being written from
scratch.
**Data needed**: none — existing textures, just an added GPU-side generation step.

## WebGL2 fallback (reconsideration)
**What**: MVP is WebGPU-only by deliberate choice. If WebGPU adoption stalls or a significant
portion of the target audience remains on unsupported browsers, revisit adding a WebGL2 fallback
path.
**Approach**: Would require an abstraction layer between the renderer and the graphics API — a
non-trivial retrofit, which is exactly why it was deferred rather than built into MVP.
**Data needed**: none — this is purely an engineering/compatibility decision to revisit later.
