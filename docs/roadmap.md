# To Boldly Glow — Roadmap

Companion to [the MVP design spec](superpowers/specs/2026-07-17-to-boldly-glow-mvp-design.md).
Each entry here is a named future feature with just enough detail to pick up later without
re-deriving requirements from scratch. Before implementation, each entry should go through its own
brainstorming → design-spec → implementation-plan cycle.

## Housekeeping (2026-11-17, mostly done 2026-11-20)

Not shipped to users (`npm audit --omit=dev`: 0 vulnerabilities).

- Done: dev tools - `npm audit fix` (minimatch via ESLint and typescript-eslint), lint, typecheck,
  tests and build pass.
- Done: narration environment - Pillow 13.0.0 (all its Dependabot alerts) and opentelemetry-api
  1.45.2; the clips came out sample for sample the same. Installed with `pip install --no-deps`
  (see `packages/data-pipeline/narration/README.md`).
- Open: transformers stays at 4.57.3 (4 high alerts, fixed only in 5.x): qwen-tts 0.1.1 pins it and
  fails on transformers 5. Low exposure - build time only, on the AI PC, loading only Qwen's own
  model. Update once a qwen-tts release supports transformers 5; accelerate stays at qwen-tts's pin.
- Open: recording Lyra's new middle line for the new supercut.
- The 0.6.0 offline zip predates two small fixes (the follow chip's font, free flight letting go of
  a followed body); they ship with the next version's zip.

## Apollo (planned 2026-11-20)
**What**: Apollo 11, later Apollo 8, 13 and 15-17. Lessons on the whole mission (launch, TLI,
docking, landing, ascent, return, quarantine; photos, original audio, measurements) and on each
vehicle (Saturn V, CSM, LM, pad 39A), outside and inside; and a very cinematic "Apollo 11" tour
with outside and inside shots - chosen by the viewer or directed automatically - including the
tower, the ascent and the lunar surface.
**Decisions**: interiors are our own to-scale cutaway models built from NASA dimensions in the
data pipeline (the Smithsonian's CC0 scan only for the command module Columbia); Lyra narrates
(en, de) with short original NASA audio clips, subtitled; documentary accuracy - the trajectory
from the Mission Report / Apollo Flight Journal state vectors, the real Moon, events in GET.
**Steps** (one session, one result each):
1. The Saturn V, taken apart (lesson; lathe-built model, exploded stack, cutaway) - spec
   `superpowers/specs/2026-11-20-apollo-saturn-v-design.md`.
2. Columbia (CSM): the Smithsonian scan inside, our own SM cutaway; interior light.
3. Eagle (LM): outside, our own cockpit, the stages separating, legs folded and deployed.
4. Pad 39A: umbilical tower, crawler, pad; a ground scene on Earth.
5. Mission data: event timeline in GET, trajectory reconstruction in the Earth-Moon system,
   tested against documented values.
6. Lesson Apollo 11, part 1: launch to lunar orbit (a cislunar scene, metre pass for the craft).
7. Tranquility Base: terrain from the LRO NAC DTM, the descent (P63/P64/P66, 1202 alarm, fuel);
   lesson part 2.
8. Lesson part 3: ascent, rendezvous, TEI, re-entry, splashdown, quarantine.
9. Original audio and photo pipeline (each file's rights checked), subtitles, data charts.
10. Camera language for the tour (cuts, tracking, onboard and tower cameras, auto direction).
11. Launch and ascent (exhaust, staging).
12. The full "Apollo 11" tour.
**Risks**: depth precision for metres beside Earth and Moon (a metre pass, as in the Voyager
encounters), interior light and shadow (the model shader has none), download size (load per
lesson), rights of every photo and audio clip (`huepattl-legal-check` before shipping).

## Eye candy: richer space visuals
**What**: Make the scene look more like space photography: livelier stars, better planet surfaces,
and the objects you'd actually see in the sky.
**Approach** (ideas to choose from):
- (Done: star colors from B−V with a point spread and spikes, the stars in the ecliptic frame; a
  painted Milky Way with nebulae, dark clouds and the nearest galaxies.) Next: a real HDR all-sky
  photograph instead of the painting (needs a reachable, reusable source), more and fainter stars
  (Hipparcos/Gaia subsets).
- Planet rendering: higher-resolution textures with streaming, normal maps from real elevation
  data (today's relief is read from the albedo), real cloud maps
  instead of the procedural cover, full atmospheric scattering (Rayleigh/Mie) for Earth/Venus/Titan,
  Saturn's ring shadow on the rings and the planet's shadow on the rings, and ring particles that
  sparkle. (Done: per-body surface materials - ocean glint with glitter, ice, regolith, gas-giant
  limb darkening - procedural Earth clouds with shadows, and atmosphere shells with a twilight
  band and a backlit ring; Earth's city lights from NASA's Black Marble 2012, and its aurora.)
  Next: the newer Black Marble 2016 at higher resolution, aurora driven by real space-weather data
  (Kp index).
- Shader/mapping techniques: physically based shading, automatic exposure, parallax or
  tessellation for relief, anisotropic ring lighting. (Done: AgX tonemapping as the Display panel's
  optional "Filmic look"; the Sun's limb darkening and granulation, with the camera stopping down
  as the Sun fills the view; the corona with streamers and prominences, opening up in an eclipse.)
- Small bodies (Done: main belt, Hildas, Trojans and Kuiper belt as GPU Keplerian particles;
  comets with coma, ion and dust tails; Ceres, Vesta, Pallas and Pluto.) Next: zodiacal light,
  real orbital elements for thousands of numbered asteroids (MPC/JPL, licensing check), comet
  outbursts and gas/dust ratios per comet, textured dwarf planets.
**Data needed**: an all-sky background map, Earth night lights, cloud and elevation maps (NASA,
public domain, or Solar System Scope, CC BY 4.0 - www.solarsystemscope.com is not reachable from
the current cloud development environment), asteroid/comet orbital elements (JPL; the JPL and
MPC APIs are not reachable from the current cloud development environment either - the elements in
`smallBodies/smallBodyCatalog.ts` were taken by hand from published values).

## Moon phase / cycle deep-dive
**What**: Explain the ~29.5-day synodic lunar cycle — why we see phases, the difference between
sidereal and synodic month, supermoon/perigee-syzygy.
**Approach**: A dedicated view showing Sun–Earth–Moon geometry from above alongside the phase as
seen from Earth, scrubbable via the shared time controller.
**Data needed**: ELP2000 lunar position (already in `packages/engine` for MVP) — mostly a new UI
view, not new data.
**Done**: a staged "Why does the Moon have phases?" lesson - the orbit from above with the phase as
seen from Earth, why the phases aren't Earth's shadow, the same face, and the crescent (with
earthshine), quarters and full Moon from the ground. **Next**: supermoons (perigee), and the real
Moon's phase for the explore view's date, which needs its real orbit (see the eclipses entry).

## Solar & lunar eclipses
**What**: Visualize and explain solar/lunar eclipse geometry (umbra/penumbra, why eclipses don't
happen every month due to orbital plane inclination), and let the user jump to real historical/
future eclipse dates.
**Approach**: Extend the Moon phase view with penumbra/umbra shadow cones; a searchable list of
eclipse dates for a given date range.
**Data needed**: eclipse date tables (e.g. NASA's public-domain eclipse catalogs) bundled or
computed from the existing orbital elements.
**Done**: a staged "What happens in a solar eclipse?" lesson - umbra and penumbra, why eclipses
don't happen every month, the Moon's shadow on Earth, and the partial phases, diamond ring,
totality and an annular eclipse seen from the ground. **Next**: lunar eclipses, and jumping to real
eclipse dates - which needs the Moon's real orbit (its elliptical distance and its node, which
turns once every 18.6 years) rather than today's fixed circular one.

## Narrated tours and more languages
**What**: The narrated grand tour (the Sun, Mercury to Neptune, home to Earth) is done, in English
and German, with a synthetic narrator spoken at build time by Qwen3-TTS (see
`packages/data-pipeline/narration/README.md`). Next:
- A longer tour of its own with the major moons and other objects (Ceres, Pluto, a comet), each
  with its own narration.
- French and Spanish: a message catalog (`packages/app/src/i18n/messages/`), a narration script,
  their names in `SUPPORTED_LOCALES` and `TTS_LANGUAGES`, and `npm run narrate`. Qwen3-TTS speaks
  both.
**Approach**: Reuse the route, pacing and narrator of the grand tour (`camera/tour/grandTour.ts`,
`narration/narrator.ts`); a moon stop needs a smaller loop than a planet's and a route through the
moon systems that doesn't zigzag.

## ISS and notable satellites
**What**: Real-time-ish position of the ISS and a curated set of notable satellites.
**Approach**: TLE (Two-Line Element) orbit propagation (SGP4 algorithm) added to `packages/engine`;
TLE data fetched periodically online when available, with a bundled last-known-good snapshot for
offline use.
**Data needed**: TLE data from Celestrak (freely republishable) or space-track.org; SGP4 propagator
(public algorithm, needs a clean-room or openly-licensed implementation to keep to MIT).

## Probes and comets
**What**: Positions of interplanetary probes (Voyager 1/2, etc.) and notable comets. (Done: seven
notable comets on published orbital elements, with tails, as camera targets.)
**Approach**: For probes beyond Earth orbit, use NASA JPL Horizons ephemeris data (freely
available; check API/bulk-data terms before bundling) rather than SGP4. Comets via published
orbital elements (e.g. from the Minor Planet Center, checking license/reuse terms).
**Data needed**: JPL Horizons ephemerides or orbital elements; needs a licensing check pass before
committing to a specific source, per the project's data-provenance discipline (§5 of the MVP spec).
Candidate sources for 3D models, photos and mission data, with their terms, are in
[asset-sources.md](asset-sources.md) (incl. the Voyager models and the Golden Record's limits).

## Live module: probes and missions
**What**: An opt-in "Live" module that, only with the user's consent, fetches current positions and
telemetry-style data of spacecraft (e.g. Voyager 1/2, New Horizons, Juno, JAXA's MMX with the
IDEFIX rover) and shows them in the scene, alongside each mission's statement/goals and its
history: launch, flybys, milestones, past trajectory and, for ended missions, the final state.
**Approach**: Builds on the "Probes and comets" entry (ephemerides rather than SGP4) and shares the
fetching/caching approach of the "ISS and notable satellites" entry. Nothing goes over the network
until the user agrees in a clear consent dialog (what is fetched, from whom, that their IP address
reaches that server); the choice is remembered and can be withdrawn. Without consent, or offline,
the module falls back to a bundled snapshot and says how old it is. Historic trajectories and
mission texts can be bundled; only the "now" part needs to be live. Likely needs a small proxy or
pre-fetched data on our own server if the sources don't allow cross-origin browser requests -
which changes what the consent and privacy notice must say.
**Data needed**: JPL Horizons ephemerides (or ESA/JAXA equivalents for their missions), NASA's Deep
Space Network "DSN Now" status for live link data, mission descriptions and milestone dates
(NASA/JPL texts are generally public domain; ESA/JAXA texts and images are not - check each). Needs
a `huepattl-legal-check` pass before any network call ships: source terms of use, GDPR/privacy
notice for the third-party requests, and attribution.

## Camera and input: look at anything, fly like a space sim
**What**: One input layer for every camera, three situations sharing the same gestures
(requested 2026-11-15, after the Voyager lessons):
- **Inspecting an object** (the Voyager probe, the Golden Record, later a planet up close): the
  pivot moves to the point double-clicked/double-tapped (raycast against the model's triangles),
  wheel/pinch zoom toward the pointer, pan (right drag or Shift+drag; two-finger drag on touch;
  Shift+two-finger scroll on a trackpad), and the reset button. No ±30° limit in object chapters,
  zoom down to about 30 cm (check depth precision up close).
- **Exploring space** (today's orbit camera): the same gestures; pivot by raycast against planets,
  moons and small bodies; logarithmic zoom; double-click fly-to keeps working and sets the pivot.
- **Free flight like a space sim** (Freespace 2, Elite), not a shooter: arrows/mouse up-down pitch
  the nose, left-right yaw, Q/E roll; W/S set a throttle that holds (X stops); strafing and
  vertical thrust only as extras on their own keys. Mouse as a virtual joystick with pointer lock
  (deflection from the centre = turn rate, crosshair and ring, "invert mouse Y" setting). Touch: a
  stick for pitch/yaw, a throttle slider, roll buttons. Gamepad via the Gamepad API. F ("Look at
  this") stops and switches to inspecting the point under the crosshair.
**Approach**: own design pass; the inspect camera first (it serves the Voyager lessons and tours).

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

## NASA retro travel poster integration
**What**: TBD — user has requested this feature and will provide details later. Placeholder entry
so it isn't forgotten; likely involves NASA's public-domain "JPL Visions of the Future" retro
travel poster series (or similar), possibly as in-app collectibles/easter eggs, a gallery view, or
per-body artwork. Needs a licensing check per the project's data-provenance discipline (§5 of the
MVP spec) once scoped, though NASA/JPL material is typically public domain.
**Approach**: TBD.
**Data needed**: TBD.

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

## WebGL2 fallback (reconsideration)
**What**: MVP is WebGPU-only by deliberate choice. If WebGPU adoption stalls or a significant
portion of the target audience remains on unsupported browsers, revisit adding a WebGL2 fallback
path.
**Approach**: Would require an abstraction layer between the renderer and the graphics API — a
non-trivial retrofit, which is exactly why it was deferred rather than built into MVP.
**Data needed**: none — this is purely an engineering/compatibility decision to revisit later.
