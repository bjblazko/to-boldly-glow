# Voyager lessons - design

Status: approved in conversation on 2026-11-15 ("go ahead"); narration audio deferred to a
second round on the bigger machine.

## Intent

The first lessons about a real spacecraft: the two Voyager probes themselves in detail, their
Golden Record, the route they took and what they measured and photographed. Two lessons, so the
same story serves two audiences:

- **"Voyager: The Farthest Journey"** (`voyager`) - for everyone, no prior knowledge.
- **"Voyager in Depth"** (`voyagerDeepDive`) - the follow-up (or a direct start) for those who want
  the engineering and the measurements.

They also set up the pattern for more spacecraft later: real 3D models converted at build time,
real trajectories, real photos and real measurements, all bundled (offline-capable, no network
calls at run time), all from sources checked in [asset-sources.md](../../asset-sources.md).

**Non-goals**: live positions (that is the roadmap's "Live module"), Voyager in the explore view,
the Golden Record's images and music (third-party copyright, see asset-sources.md), narration
audio (texts are prepared; the clips are spoken in a later round).

**Anti-goals**: anything that only looks right - the route is the real one from JPL Horizons, the
charts show real data, the model is NASA's; every simplification is said in the lesson's note.

## Content

Beginner (`voyager`), chapter by chapter:

1. **Two probes, 1977** - the probe turning slowly; size, mass, launch dates, distance today.
2. **What's on board** - hotspots: dish, cameras, power, magnetometer, Golden Record.
3. **The Golden Record** - the record, label side: what is on it (titles only).
4. **Instructions for finding us** - the cover's engravings, a few hotspots.
5. **A rare alignment** - the real solar system, 1977-1981, both trajectories drawing on.
6. **Jupiter, 1979** - flybys, with a Voyager photo.
7. **Saturn, 1980-81** - with a photo; Voyager 1 leaves the planets' plane.
8. **Uranus and Neptune** - Voyager 2 alone, 1986 and 1989, with a photo.
9. **The Pale Blue Dot** - 1990, with the photo.
10. **Into interstellar space** - zoomed out to the heliopause, up to today; points to the deep dive.

Deep dive (`voyagerDeepDive`):

1. **Taken apart** - exploded view of the main assemblies.
2. **Power from plutonium** - the RTGs.
3. **Talking across 25 billion km** - dish, transmitter, Deep Space Network, light time today
   (computed from the trajectory).
4. **The instruments** - which instrument sits where.
5. **Gravity assists** - route plus a chart of the real heliocentric speed against the Sun's
   escape speed (both from the Horizons trajectory).
6. **Leaving the plane** - side view of the two trajectories.
7. **Crossing the heliopause** - chart of Voyager 1's own measurements in 2012 (SPDF merged daily
   data): heliospheric particles drop, galactic cosmic rays rise, the field strengthens.
8. **Reading the cover** - every engraving on the cover explained via hotspots.
9. **Still talking** - where they are now, what is still switched on.

## Approaches considered

- **Probe in a lesson scene of its own (chosen)**: each chapter kind stages its own scene like the
  eclipse and Moon-phase lessons. Fits LessonSession's `StagedLessonScene` seam, keeps the explore
  view untouched.
- Voyager as an object in the explore view: needs the probe at two wildly different scales (a 4 m
  probe in a solar system) and a camera that can follow it - a separate, later feature.
- Pre-rendered images/video of the probe: no interaction, no reuse for other spacecraft.

## Design

**Assets (data-pipeline, run once, output committed)**

- `convertVoyager` - decodes NASA's `Voyager Probe (B).glb` (Draco, WebP; gltf-transform +
  draco3dgltf, dev-only), bakes the node transform (1 unit = 1 m, +Y = the dish's axis), splits the
  mesh into assemblies by connected components (dish, bus, RTG boom, science boom, magnetometer
  boom, radio antennas, Golden Record), and writes a small model format (`.json` + `.bin`, see
  `packages/app/src/spacecraft/modelFile.ts`). The NASA logotype in the texture is painted over.
  Also crops NASA's photos of the record's cover and label into square textures.
- `fetchVoyagerTrajectories` - JPL Horizons vectors (heliocentric, ecliptic J2000, AU) for
  Voyager 1 and 2 from launch to 2030, dense around flybys; written as a compact binary.
- `extractHeliopauseData` - Voyager 1 daily merged data (SPDF) for 2012, as a small JSON.
- Photos (Photojournal, NASA/JPL) resized into `public/images/voyager/`.

**App**

- `spacecraft/` - model loading (`modelFile.ts`) and a `SpacecraftRenderer` (textured, lit by the
  Sun's direction, double-sided, per-assembly offset for the exploded view).
- `learn/voyager/` - `VoyagerLesson` (a `StagedLessonScene`) with three chapter kinds:
  `probe` (the model, optional exploded view and hotspots), `record` (a disc with the cover or
  label texture, hotspots), `route` (the real solar system at an animated date with both
  trajectories drawn up to that date, the heliopause as a ring when zoomed out).
- `LessonSession`/`LessonCamera` learn one new thing: a staged scene may give a chapter its own
  camera shot (preset and bounds) instead of one per kind.
- The lesson panel learns two: a photo with its credit, and a chart (inline SVG).
- Hotspots are screen labels with a line to their 3D anchor, like the eclipse lesson's labels.
- A new library shelf "Missions".

**Narration**: both lessons' chapters are in the export for `npm run narrate`; until their clips
exist they are listed as pending, which the manifest test accepts, and the lesson stays silent.

**Credits**: model, photos, trajectories, measurements in `CREDITS.md` and `credits.ts`.

## Left to the builder

Exact camera shots, hotspot anchor points, chart styling (dataviz skill), and the wording of the
texts (English and German, from NASA/JPL mission pages and fact sheets).
