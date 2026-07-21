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

### Fixed

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

### Security

- Resolved 11 open Dependabot alerts by upgrading vite (5.4 → ^6.4.3) and vitest (2.1 → ^3.2.6)
  across all workspace packages, including a critical arbitrary-file-read alert in vitest's UI
  server. All dev-only tooling, never shipped to users.
