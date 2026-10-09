# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial design specification for the MVP (see `docs/superpowers/specs/2026-07-17-to-boldly-glow-mvp-design.md`).
- Roadmap document naming deferred features (see `docs/roadmap.md`).
- Render all 8 planets (Mercury through Neptune), not just Earth, orbiting the Sun.
- 4x MSAA antialiasing on all rendered spheres.
- Toggleable orbit-path overlay showing each planet's full orbit.
- Realistic ⇄ Explorer visual scale slider, blending between true-to-scale distances/sizes and a
  compressed, exaggerated view suited for exploration.
- Toggleable name labels over the Sun and each planet.
- The scene now fills the browser window and adapts its resolution (including render targets and
  camera aspect ratio) when the window is resized, instead of rendering into a fixed 800x600 box.
- Real 2K albedo textures for the Sun and all 8 planets, replacing flat-color shading (see
  `CREDITS.md` for sourcing).
- A real starfield background (~9,100 stars from the Yale Bright Star Catalogue, converted
  offline by the new `packages/data-pipeline` package), toggleable via a "Show stars" control.
- HDR bloom post-processing around the Sun, toggleable via a "Show bloom" control. Falls back to
  the pre-bloom direct rendering path if the required texture format isn't available.
- Anamorphic-style lens-flare sprites (aperture-blade polygon "ghosts" and a horizontal streak)
  along the camera-to-Sun screen axis, occluded correctly when a planet passes in front, toggleable
  independently via a "Show lens flares" control.
- Saturn's rings, alpha-blended and correctly occluded against the planet itself.
- A subtle specular highlight on lit planets, in addition to diffuse shading.
- Every body now rotates on its own axis at its real sidereal rotation rate (retrograde for Venus
  and Uranus).
- 9 major moons — the Moon, Jupiter's 4 Galilean moons (Io, Europa, Ganymede, Callisto), Titan,
  Titania, Oberon, and Triton — orbiting their parent planet on a simplified circular path (real
  orbital period and distance, no orbital inclination modeled), toggleable via a "Show moons"
  control. Triton orbits retrograde, matching the real body. Titania, Oberon, and Triton render as
  a flat illustrative color rather than a texture (see `CREDITS.md`).
- A filter-as-you-type search box for the Sun, planets, and moons. Selecting a result flies the
  camera to it with an eased transition, then locks the orbit camera's target onto the entity's
  live position every frame — following it through its orbit and rotation — while still allowing
  free manual drag-orbit/zoom around it.
- The camera now also reorients toward a Sun-relative framing angle as part of flying to a search
  result, so the starfield visibly (and correctly) rotates during the flight instead of staying
  frozen.
- The orbit camera now rebases "up" on the scene's true ecliptic north instead of a hardcoded world
  axis, and reorients toward a followed entity's own real pole during fly-to — e.g. Earth's actual
  north now reads top-of-screen when followed, instead of a generic or arbitrary direction.
- Mip chains for all body textures, plus anisotropic texture filtering, so small/distant spheres no
  longer alias or shimmer under minification.
- A Realistic ⇄ Compact scale toggle (renamed from "Explorer"), replacing the continuous slider with
  an animated two-state transition between true-to-scale and a compressed exploration-friendly view.
- Soft shadow casting: moons on their planets, planets on their moons, and Saturn's rings on Saturn
  itself.
- Atmospheric rim/limb glow for Earth, Venus, and the four gas giants.
- Smooth analytic fading for lens flares as they pass behind an occluding body, plus a new
  corona/halo flare around the Sun.
- Raised the shared sphere mesh from 32x32 to 64x64 segments, reducing visible polygon faceting on
  planet/moon silhouettes.
- Bump mapping and ambient occlusion for lit bodies, driven by an optional per-body/per-moon height
  map. Synthetic "pseudo-bump" maps for the four gas giants (Jupiter, Saturn, Uranus, Neptune),
  derived from their own already-licensed color textures via a new offline data-pipeline script (see
  `CREDITS.md`) — no real rocky/icy body currently ships with a bump map, since no licensable
  height-map source was found for any of them after checking Solar System Scope and USGS
  Astrogeology.
- A translucent, Fresnel-driven cloud shell around the four gas giants, giving a soft
  atmosphere-seen-from-space haze toward the limb.
- Redesigned control overlay: a bottom dock (Camera / Time / Display) raising one contextual sheet
  at a time, replacing eight scattered floating boxes. The time-shuttle slider now shows a fixed
  center tick with a fill that grows outward from it, making "center is stopped, left rewinds, right
  fast-forwards" visible instead of implicit in a number.
- Expanded the README with a screenshot, a fuller project description, and "For users"/"For
  developers" chapters.
- A "How big are the planets?" Learn-mode lesson: the Sun and all 8 planets rendered at their true
  real-scale relative sizes in a single largest-to-smallest lineup (no orbital distances involved),
  with one page per planet giving its diameter, circumference, and average distance to the Sun in
  km and AU. Now the first item in the lesson picker.
- Each lesson now shows a short note on what is and isn't to scale (the seasons lesson: sizes,
  distances and speeds are exaggerated, all angles are true).
- The Milky Way behind the stars: its band of star clouds split by dark dust lanes, the glowing
  bulge toward Sagittarius, nebulae (Orion, Lagoon, Carina, North America, the Veil and more), dark
  clouds like the Coalsack, the Andromeda Galaxy and the Magellanic Clouds - all at their real
  places among the catalog stars. It is painted once by the data pipeline (`npm run paint-sky`)
  into a galactic-coordinate panorama, so drawing it costs one texture lookup per pixel. A Milky
  Way switch in the Display panel turns it off.
- The asteroid belts: about 40,000 bodies on Keplerian orbits solved on the GPU each frame - the
  main belt with its Kirkwood gaps, the Hildas tracing their triangle in step with Jupiter,
  Jupiter's two swarms of Trojans, and the Kuiper belt with its plutinos - plus Ceres, Vesta, Pallas
  and Pluto on their real orbits. From afar they are sunlit dots (brightest at full phase); up close
  they become lit, lumpy rocks. An Asteroids switch turns them off.
- Comets on their real orbits - Halley, Encke (back at perihelion in February 2027), 67P,
  Hale-Bopp, Swift-Tuttle, Pons-Brooks and NEOWISE - waking up as they near the Sun: a green coma, a
  thin blue ion tail pointing straight away from the Sun, and a broader dust tail curving back
  along the orbit. A Comets switch turns them off.
- Comets, Ceres, Vesta, Pallas and Pluto are camera targets: search for them (or double-click
  them) to fly there and follow them, with labels next to them. Their orbits have their own switch
  ("Comet & dwarf orbits"), separate from the planets'.
- Double-click or double-tap any body to fly there and follow it.
- The README lists where every texture, catalog and data set comes from, and under which license,
  and its screenshot shows the current look.
- Free flight on touch screens: a thumbstick to fly and strafe, buttons to rise, sink and boost,
  drag to look, pinch to set the speed. Orbit mode zooms with a pinch.
- The Sun is a glowing ball instead of a flat disc: limb darkening dims its edge and turns it redder
  (per color, from the measured solar values), and up close its granulation shows - convection
  cells about 1,300 km across that boil up and fade within ten minutes of simulated time. When the
  clock runs so fast that granules come and go within a frame, they average out instead of
  flickering. As the Sun's disc fills the view, the camera stops down like a solar filter, so its
  surface no longer burns out to white.
- A "Filmic look" switch in the Display panel (off by default): AgX tonemapping instead of
  Reinhard, so very bright light burns out toward white the way it does on film instead of staying
  saturated, with deeper blacks.
- The Sun's corona: a pearly glow falling off steeply away from the Sun (Baumbach's K-corona
  profile), combed into helmet streamers with long thin stalks, fine radial rays and fainter polar
  regions, fixed to the Sun so it turns with it. Beside the bright disc it shows only faintly; when
  a planet or moon covers the Sun - fly behind Earth until it eclipses the Sun - the exposure opens
  up and the corona shows in full, with the red chromosphere and prominences standing out at the
  limb. A partial eclipse keeps it faint: the last sliver of the disc still outshines it.
- Earth's city lights on its night side, from NASA's Black Marble 2012 ("Earth at Night"): they come
  on after sunset, shine warm like sodium and LED street lighting, and are dimmed under clouds.
- Earth's aurora: green curtains with red tops ringing both geomagnetic poles on the night side,
  reaching farther from the poles around midnight than around noon, folded and combed into vertical
  rays, breathing with substorms. Looking down they are faint bands over the night side; at the limb
  they rise above the horizon as a bright glow, as seen from the space station.
- A "What happens in a solar eclipse?" Learn-mode lesson in eight chapters, first from space, then
  from the ground. From space: the Sun, the Moon and Earth lined up at new moon, with the edges of
  the Moon's umbra and penumbra drawn in; the Moon's tilted orbit lifting its shadow clear of Earth
  at most new moons; and a close-up of Earth's day side with the Moon's real shadow (a dark core in
  a soft smudge, outlined in the same colors) sweeping across it. From the ground, in the path of
  totality, under a new sky with hills on the horizon: the dazzling Sun in a blue sky with the
  eclipse already under way; the crescent through eclipse glasses; the diamond ring; totality - the
  corona and prominences around the black Moon, the sky deep blue with a sunset glow all around the
  horizon and the real stars around the Sun coming out; and an annular "ring of fire". The Moon
  slides smoothly from one stage to the next. The texts cover eye safety (ISO 12312-2 glasses, and
  when it is safe to look) and name the next total eclipse, 2 August 2027.
- A "Why does the Moon have phases?" Learn-mode lesson in seven chapters. From above: the Moon
  circling Earth with sunlight arriving from one side, the four main phases named around its orbit
  and a card showing the Moon as seen from Earth at every moment; from the side, Earth's shadow
  pointing away from the Sun with the full Moon passing below it (the phases are not Earth's
  shadow); and a marker showing the Moon always turning the same side to Earth. Then from the
  ground, the sky turning with the Moon: the evening crescent low over the dusk glow with
  earthshine on its dark part, first quarter at sunset, the full Moon rising opposite the setting
  Sun under the pink Belt of Venus, and last quarter at dawn. The Moon's shape comes from the real
  lighting, not a drawing.
- Earthshine: a lesson can light the Moon's night side with the sunlight Earth reflects, brightest
  around new moon.
- The "Get to know the planets" lesson flies the camera to each planet in turn, close enough to
  fill the view (Saturn with its rings), turned toward the Sun so most of its face is lit. Each
  planet's page lists its facts as bullet points with pictograms: diameter, circumference, mass,
  rocky / gas giant / ice giant, atmosphere, temperatures (coldest and hottest on the rocky planets,
  the cloud tops on the giants), distance from the Sun, how long it takes to spin once, and its year.
- "Get to know the planets": the planet in focus turns slowly on its axis, the way it really
  spins (Venus and Uranus backwards) but every planet equally fast, one turn in 30 seconds.

### Changed

- "How big are the planets?" is now "Get to know the planets", as each planet's page tells more
  than its size.
- The HUD is organized around two modes, switched at the top of the screen: **Explore** and
  **Learn**. Explore's dock has Find, Camera, Time and View. Find is a searchable tree of every body
  by kind - the Sun, planets with their moons under them, dwarf planets, asteroids, comets - that
  narrows down as you type (Enter flies to the first match). View holds what the scene shows (scale,
  orbits, labels, bodies, sky); how the picture is rendered (bloom, lens flares, the filmic look)
  moved to a Settings popover. Learn opens a lesson library with the lessons on topic shelves,
  searchable, and remembers where each lesson was left; in a lesson its own dock has the library,
  back, a chapter counter that lists every chapter to jump to, next, and View, and the text card
  folds down to its title. Lesson scenes from space can be zoomed and turned a little (scroll,
  pinch, drag, or the buttons on the right), with a button back to the lesson's own view. Ctrl+K
  (Cmd+K) or the search button searches everything: objects, lessons and settings.
- Search and Settings at the top right, and a lesson's zoom buttons, sit on small glass slabs like
  the dock and the mode switch, as flat keys, instead of floating with hard white edges; open
  Settings lights up like an open dock panel. On narrow phones the mode switch moves to the left
  so it no longer overlaps them.
- A new look for the HUD, "Dichroic Slab": the dock, its panels, the lesson panel and picker and
  the Moon-phase card are thick slabs of smoked glass with sharp corners, a facet split across each
  face and an edge that glows cyan, violet, magenta and gold. Buttons are glass keys that press in,
  the main action of each panel has a dichroic face, the Display settings are on/off switches
  whose track lights up in the edge colors, and the time slider has a gold-edged cube for a thumb.
  Every dock panel has a title and a close button.
  The HUD and the labels in the scene are set in Inter Tight, readouts in IBM Plex Mono, bundled
  with the app instead of loaded from a font service. Mock-ups of this and five other directions
  are in `docs/design/glass-concepts/`.
- The Learn-mode sky and horizon are shared by every lesson that shows the view from the ground:
  at dusk and dawn the sky glows only on the Sun's side, with the pink band opposite. The camera
  hint about dragging and zooming no longer shows during a lesson, which steers the camera itself.
- The free-fly camera flies like a spaceship in a game instead of a plane: thrust and strafe with
  `W`/`A`/`S`/`D` or the arrow keys, rise and sink with `R`/`F`, roll with `Q`/`E`, boost with
  `Shift`, look around by dragging, set the speed with the mouse wheel. It eases in and out of
  motion, slows down near planets and speeds up in open space, stops at surfaces instead of flying
  through them, and levels itself with the ecliptic when you stop rolling. The orbit camera got
  weight too: a released drag keeps turning a little, zoom glides, and the keyboard turns and zooms
  it. A short hint recalls the controls whenever the camera mode changes.
- The stars sit in the scene's real (ecliptic) frame - the planets pass through the zodiac
  constellations - and shine in their own colors, derived from each star's B−V color index, with a
  soft point spread and diffraction spikes on the brightest few.
- A subtle lens flare is on by default (and was toned down).
- Every planet and moon reflects sunlight like its own kind of surface instead of one shared matte
  sphere with the same small highlight. Earth's oceans show the Sun's glint - brighter toward the
  limb, broken into glitter by waves - and its ice a broad sheen; the Moon, Mercury and Callisto
  scatter like dusty regolith, evenly bright out to the limb; Mars is matte dust with shiny polar
  ice; the gas giants have no hard highlight but darken toward the limb; Venus and Titan show a
  soft haze. Water and ice are read from each body's own albedo texture, and craters and mountain
  ranges stand out as slightly exaggerated relief read from it too. Color textures are shown in
  their own colors instead of being multiplied by each body's flat label color (grayscale ones
  still take it), and night sides are darker.
- Earth has a light, procedural cloud cover that turns with the planet, drifts with the trade winds
  and westerlies, and casts shadows on the ground; a Clouds switch in the Display panel turns it
  off, and lessons hide it like the other explore-mode extras.
- Earth's atmosphere reaches past its limb, turns sunset-colored along the terminator, and - like
  Venus's and the gas giants' - lights up as a reddened ring when the planet is in front of the Sun.
  The gas giants' cloud shells became per-planet atmosphere shells (`atmosphereShell/`).

- Lens flares look like a film camera's: a blue anamorphic streak, the aperture's starburst, a
  faint rainbow halo, six-bladed aperture ghosts with colored fringes along the line through the
  screen center, and lens dirt that lights up near the Sun - in HDR, so bloom catches the streak.
  They fade out as the Sun leaves the frame instead of switching off at the edge. Sizes follow the
  window, not fixed pixels. They draw in one instanced call in a camera-effects pass of their own,
  onto the finished scene image (one sample per pixel, no depth buffer), with tight quads and each
  shape's geometry computed once for all color channels - cheap enough for software WebGPU.

- The camera tour now flies like a heavy spaceship: it starts from rest, accelerates and brakes
  within an engine limit, with thrust that builds up and dies down instead of switching between
  full throttle and full brake, and eases into each new speed. Its heading and gaze turn with
  inertia - every turn eases in and out, also when it leaves one planet for the next - and it banks
  into turns. The final approach zooms in on the planet at a steady pace at any scale, and the
  flyby lap is a little more leisurely (10 s). Stopping it hands the view to free-fly with the same
  roll instead of levelling it with a jolt.
- The app's source is grouped by subject instead of by technique: each visible feature (bodies,
  Saturn's ring, cloud shells, starfield, orbit paths, lens flares, bloom, labels) keeps its shader,
  pipeline, uniforms and drawing together; lessons supply their own scene layout instead of being
  special-cased inside one 600-line frame function. ESLint now enforces clean-code limits
  (complexity, function length, parameters, nesting, file size) and type-aware rules, and tests are
  type-checked too. Rendering is unchanged, verified pixel by pixel on 20 reference scenes.
- Toolchain upgraded after reviewing each release's migration notes: Vite 6 → 8 (Rolldown/Oxc),
  Vitest 3 → 5, TypeScript 5 → 6, ESLint 9 → 10, AssemblyScript 0.27 → 0.28,
  Playwright 1.47 → 1.63. Node.js 22.12+ is now required (`.nvmrc` pins 24, which CI reads too).
  The production build renders pixel-identical scenes before and after.

### Fixed

- "Get to know the planets" looked at the lineup along the ecliptic's axis, so the planets
  showed a pole instead of their equator. The camera now looks across the row from the side, with
  ecliptic north up, and each planet's axis is tipped sideways by its real axial tilt, as in a
  picture book: Earth leans by 23°, Uranus lies on its side and Venus stands on its head.
- On phones the whole interface rendered at desktop size and tiny (the page had no viewport meta
  tag); it now fits the screen, and taps on the HUD no longer trigger the browser's double-tap zoom.
- The Display panel scrolls instead of growing past the top of a short window.
- The camera tour works at Realistic scale: it matches its target planet's orbital motion, so it
  catches even Mercury, Venus and Earth, which used to outrun it at loop speed until it gave up on
  them. Switching the scale mid-tour no longer throws it out of step: near its target the ship
  keeps its place relative to the planet (so the view of it stays the same), farther out it moves
  with the solar system, and the leg is re-planned for the new distances. Jumps in the simulated
  time no longer fling it off either.
- Lens flares no longer disappear behind planets: each flare element was depth-tested at the Sun's
  depth, so any planet anywhere in the picture cut a hole into the ghosts it overlapped. A flare
  now lies over the whole picture, and only a body actually in front of the Sun dims it.

- A lost GPU device (driver reset, GPU process crash) no longer leaves a silently frozen picture:
  the app says so and offers a reload.
- The canvas now follows changes of its own size and of the device pixel ratio (moving the window
  to another screen), not only window resizes.
- With labels re-enabled during the seasons lesson, planets the lesson hides no longer show their
  name labels at their real positions, and they no longer dim the lens flare.
- CI never got past type-checking (it ran before the engine build the app's types come from), so
  the e2e suite never ran on GitHub. `npm run lint` and `npm run typecheck` now build the engine
  first, so they work on a fresh checkout too, the actions moved to their Node 24
  releases, and Chromium is allowed to fall back to software WebGPU on GPU-less runners.
- Pixel-level e2e tests no longer queue up frames faster than software WebGPU can render them,
  which stalled the browser for the next test (a reproducible timeout in CI).

- Every body (Sun, planets, moons) now has a real axial tilt and rotation axis, sourced from IAU
  pole-orientation data — previously every body spun around the scene's vertical axis, which for
  planets lay *inside* their own orbital plane rather than roughly perpendicular to it. Uranus now
  visibly rolls onto its side; Saturn's ring shares the sphere's own real tilt instead of a
  separate hardcoded angle; moons' orbital planes now track their parent's real tilted equator
  (most visibly for Titan, Titania/Oberon, and Triton) instead of a fixed flat plane.
- Moons were spinning with the same sign as their orbital angle, which — given how their rotation
  and orbital-position math compose — made them sweep through two extra full rotations per orbit
  instead of staying tidally locked, so every side was visible over an orbit rather than one face
  staying toward the parent.
- Camera-follow snapped exactly to the followed entity's position every frame; for a close/fast
  orbiting moon (e.g. Europa) under time acceleration, this whipped the camera through the moon's
  own fast orbital motion, making everything else in view swing wildly rather than moving smoothly.
  The camera now eases toward the live position each frame instead of snapping to it.
- The sphere and ring mesh generators used local +Y as the polar axis while the tilt/spin rotation
  math assumed local +Z, an exact 90-degree misalignment for every body at every tilt value.
- The orbit camera orbited/rendered "up" relative to world Y instead of the scene's real ecliptic
  plane, which only looked correct by coincidence at azimuth 0.
- The fly-to camera tween used linear interpolation instead of a spherical one for near-antipodal
  up-axis transitions (e.g. flying to Venus), producing a visible "whippy roll" mid-flight.
- Body and moon motion was quantized to whole-hour steps because the Julian Day conversion discarded
  minutes/seconds/milliseconds from its input, most visible at the "1 hr/s" time-scale preset.
- Realistic-scale body radii and moon-orbit radii collapsed to Explorer-mode proportions almost
  immediately off the low end of the scale slider, from a linear (rather than geometric)
  interpolation between the two endpoints.
- The camera's closest possible zoom and its near-clip plane were both tuned for Explorer-scale body
  sizes, making it impossible to zoom in on anything at Realistic scale.
- A shader-side pole-magnification artifact — ordinary texture noise near a sphere's poles becoming
  visibly swirled/magnified under near-polar viewing, most visible on Saturn — fixed with a mip-blend
  fade near the poles.
- Saturn's ring shadow, and the ring's own lighting, used the wrong local axis for the ring plane's
  normal, producing a shadow band at the wrong orientation relative to the visible rings.
- The bump-mapping tangent-basis calculation had its cross-product operands swapped, inverting
  surface relief (raised terrain shaded as pits and vice versa); bump/height-map textures were also
  being gamma-decoded as if they were color data instead of raw height values.
- Venus spun prograde: its pole was stored as the right-hand-rule pole (RA 92.76°, Dec -67.16°)
  while its negative rotation period also encoded retrograde spin, cancelling out. It now uses IAU's
  published north pole (RA 272.76°, Dec 67.16°), the same pole-plus-signed-period pairing Uranus uses.
- Titania and Oberon orbited against Uranus's own spin, and Triton orbited prograde (its negative
  period undid the retrograde sense its 157° inclination already encodes). Moons now orbit in their
  parent's rotation sense, and Triton's period is positive.
- Every body texture rendered as its own mirror image (the sphere mesh's longitude ran clockwise
  seen from north). Tidally locked moons now also keep their longitude-0 face, rather than the
  90° meridian, toward their parent.
- The far clip plane (1000 units) cut off the far side of Neptune's orbit at Realistic scale when
  zoomed out; it is now 2000 units.
- The camera tour teleported up to half a loop radius on every loop entry, flipped its roll by
  ~95° within a frame while looping over each planet's pole, and whipped its view around when a loop
  ended. Loops now start where the camera arrives and circle level around the planet, and the gaze
  turns smoothly. The tour also starts from the current view instead of inside the Sun, and hands
  back to the free-fly camera without a roll jump.
- Fly-to framing computed its Sun-facing azimuth for the starting up-axis but applied it after
  turning to the target's pole, missing the sunlit side when flying on from a tilted body (e.g.
  Uranus). Fly-to also now aims at the target's live position, instead of where it was when the
  flight began, so time acceleration no longer leaves the camera lurching after it.
- Camera motion and tweens no longer integrate a whole hidden-tab gap in one frame; fly keys no
  longer stay stuck after the window loses focus or fire while typing in the search box or using the
  time slider; a second touch no longer makes the orbit drag jump; the fly camera's orientation no
  longer drifts from unit length.
- Pressing Enter/Space on the focused tour button restarted the tour instead of stopping it, and
  picking a search result during the tour left the tour on screen.
- Opening a lesson while following a body, touring, or in free-fly mode showed the wrong camera
  (the follow dragged the lesson camera away; the tour or fly camera kept rendering instead of the
  lesson framing). Leaving a lesson now also restores the explore-mode camera and its zoom limits —
  after the sizes lesson the camera was left inside the Sun with a near plane ~4000x too small.
- The e2e suite was failing against the current UI (flares now default off, the dock stays visible
  in learn mode, and Earth's label visibility depended on the day the test ran).
- The seasons lesson's staged chapters flattened Earth's axis so its tilt against the orbit shrank
  to 0° at the equinoxes, contradicting the orbit chapter. The axis now keeps its true 23.4° all
  year and points sideways at the equinoxes; the reference line and arc follow it in 3D, and the
  angle label says how far the axis leans toward or away from the Sun (the Sun's declination). The
  location markers stay on the sunlit, camera-facing side in every chapter.
- Lessons no longer follow the Realistic/Compact toggle: at Realistic scale the seasons scene showed
  a speck-sized Sun and its overlay lines flickered or vanished behind Earth.
- Lesson scenes are framed into the space above the lesson panel, which used to cover Location B
  and Earth's southern hemisphere (and the planet-size lineup) on common screen sizes; the panel
  itself no longer runs under the dock.
- In the Moon phases lesson the sky seen from the ground no longer flips around the Moon for a few
  frames on the way to full moon (or back from it): with the Sun nearly opposite the Moon its
  altitude no longer decides how the sky leans, so the view turns smoothly and comes to rest
  upright.
- The planet-size lesson's facts were half German, half English; they are English throughout.
- Seen from close to the Sun, its corona no longer ends in a hard-edged band across the sky; it
  fades out to the side.
- The Moon phases lesson's "seen from Earth" card no longer hides under the top bar on narrow
  screens.

### Security

- Resolved 11 open Dependabot alerts by upgrading vite (5.4 → ^6.4.3) and vitest (2.1 → ^3.2.6)
  across all workspace packages, including a critical arbitrary-file-read alert in vitest's UI
  server. All dev-only tooling, never shipped to users.
