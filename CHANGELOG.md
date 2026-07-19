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
