# Voyager tours - design

Status: draft for approval (2026-11-15). Narration audio deferred, as for the Voyager lessons.

## Intent

Two tours in the Tours mode, "Voyager 1" and "Voyager 2": you follow the probe from launch to
today, the date running with it, and at every station - each planet, each milestone - a card shows
photos, measurements and findings. Lean back and watch, or jump to a station on a timeline.

It builds on the Voyager lessons (model, trajectories, photos, data, labels, panel cards) and is the
pattern for later missions (New Horizons, Cassini, ...).

**Non-goals**: live positions, steering the camera freely during the flight (looking around a
little is fine, as in lessons), Voyager in the explore view outside the tour, the Golden Record's
sounds and pictures (copyright, see asset-sources.md).

**Anti-goals**: a flyby that looks wrong (the path through a planet), cards that pretend to load
something live, a tour you cannot stop or skip.

## Experience

- **Flight phases** (between stations): outside view at Compact scale, as in the route chapters -
  planets where they were on that date, the probe's path drawing on, the camera following the probe
  from a slowly moving point of view. Time runs fast (months per second), slowing toward a station.
- **Encounters** (the planet flybys): the scene switches to a true-scale view around the planet: the
  planet at its real size, the probe at its real distance on its real flyby path, the camera just
  behind the probe (NASA's model, a few dozen metres away), time slowed to hours per second. The
  planet sweeps past; the card opens.
- **Milestones without a planet** (launch, overtaking, Pale Blue Dot, termination shock,
  heliopause, today): an outside view, time held, the card open.
- **Cards**: title, date, distance from the Sun, one or two sentences, a photo or chart with credit
  and "included with the app", two to four facts. The narrator (subtitles until the audio exists)
  speaks the station's text; the tour waits for it, as the grand tour does.
- **Timeline bar** at the bottom: the stations as points on 1977-2026 (not to scale: flybys get
  room), the current moment, play/pause, previous/next station. A click on a point flies there.
  Paused, time and camera hold and the card stays open.
- Ending: at "today" the tour stops; Explore (top switch) or the timeline's close button leaves it.

## Stations

Voyager 1: launch (5 Sep 1977) · overtakes Voyager 2 (Dec 1977) · **Jupiter** (5 Mar 1979, 349,000
km from the centre: Io's volcanoes, the ring, the Great Red Spot) · **Saturn** and **Titan** (12 Nov
1980: the ringlets, Titan's thick nitrogen haze; the turn out of the plane) · Pale Blue Dot (14 Feb
1990) · termination shock (16 Dec 2004, 94 AU) · heliopause (25 Aug 2012, 121.6 AU, chart) · today.

Voyager 2: launch (20 Aug 1977) · **Jupiter** (9 Jul 1979: Europa's cracked ice) · **Saturn**
(26 Aug 1981) · **Uranus** (24 Jan 1986: new moons, Miranda, a lopsided magnetic field) · **Neptune**
and **Triton** (25 Aug 1989, 4,950 km above the cloud tops - the closest pass of the mission: Great
Dark Spot, Triton's geysers) · termination shock (30 Aug 2007, 84 AU) · heliopause (5 Nov 2018,
119 AU, chart) · today.

Exact figures are checked against NASA/JPL pages while writing the texts.

## Approaches considered

- **A - a mission-tour mode of its own (chosen)**: a timeline per probe drives the date, the camera
  and the switch between flight and encounter; it reuses the lessons' route scene, model renderer,
  trajectories, cards and the grand tour's narrator and subtitle bar.
- B - extending the grand tour's ship (TourController): its inertial flight toward bodies at the
  current date doesn't fit time travel along a given path or the change of scene at an encounter.
- C - a self-advancing lesson: lesson panel and fixed shots per chapter; no following flight.

## Design

**Data (pipeline, committed)**
- Encounter paths: JPL Horizons vectors of each probe *relative to the planet* (CENTER = the
  planet), hourly for a few days around each closest approach, so the flyby can be drawn at true
  scale. Plus the moons' positions where a card names them (Titan, Triton, Io, Europa, Miranda).
- More photos from NASA's Image and Video Library (Io's plume, Europa, Titan's haze, Miranda,
  Triton, Uranus), each checked for a NASA/JPL credit.
- Voyager 2's heliopause data from SPDF's merged daily file, like Voyager 1's.

**App**
- `missions/` (domain folder): `MissionTimeline` (stations: date, kind, camera, card; and the time
  mapping that slows near stations), `MissionTour` (plays the timeline: clock, pause, jump; asks the
  narrator for pacing), `EncounterScene` (true-scale planet and flyby path; the probe drawn in a
  pass of its own in metres, with the same camera rotation, so 4 m and 350,000 km can share one
  picture), `MissionCard` and `MissionTimelineBar` (DOM, HUD style).
- The scene: the tour supplies the frame's layout and overlays the way a lesson does (the scene
  renderer gets one "staged scene" source - a lesson or a mission tour - instead of only lessons).
- The Tours mode's library gets the two cards; starting one leaves a lesson, stopping returns to
  Explore with the camera and date put back.
- Narration: a script per station (en, de) in the narration export, listed as unrecorded; the tour
  paces by the texts' estimated length until clips exist.

**Credits and legal**: every new photo and data file in CREDITS.md and credits.ts (the credits test
enforces it); still no network request at run time.

## Left to the builder

Camera paths per phase, time mapping curve, timeline bar layout on small screens, card wording.
