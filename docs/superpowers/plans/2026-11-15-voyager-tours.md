# Voyager Tours Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two narrated mission tours (Voyager 1, Voyager 2) that follow each probe from launch to today, slowing into true-scale flybys with cards of photos, data and findings, plus the Golden Record's "picture in a sound" chapter.

**Architecture:** A `missions/` domain folder: a pure timeline (stations, time mapping), a player (clock, pause, jump, narrator pacing), a flight scene (the lessons' RouteScene, camera following the probe) and an encounter scene (true-scale planet; the probe in its own depth range in metres). The scene renderer gets its staged scene from whichever is active: a lesson or a mission tour.

**Tech Stack:** TypeScript, WebGPU (WGSL), Vitest, the data pipeline (tsx, sharp, JPL Horizons API).

**Spec:** `docs/superpowers/specs/2026-11-15-voyager-tours-design.md` (and `2026-11-15-voyager-lessons-design.md` for what it reuses)

## Global Constraints

- No network request at run time; every photo/data file bundled and credited (credits test).
- Photos and data: NASA/JPL/SPDF only, credit line per file; no Golden Record images or music.
- Texts in en and de (Messages type); narration texts exported, listed as unrecorded.
- ESLint metrics: functions ≤ 40 lines / 15 statements / complexity 8, files ≤ 300 lines, ≤ 4 params.
- Reduced motion: no automatic camera flights; stations shown at their end state.

## Review Focus

- Pausing during the fade into an encounter: the tour must hold in a consistent state (no half-faded screen) - test in Task 3.
- Jumping to a station while the narrator speaks: the old clip stops, the new station's starts - test in Task 3.
- Leaving the tour (Explore, starting a lesson): camera, date, scale and labels restored - test in Task 6.
- A window resized during an encounter: probe and planet stay framed (both projections from the same canvas size) - Task 5.
- Missing narration clips: the tour paces by the text length and keeps moving - test in Task 3.

---

### Task 1: The picture in a sound (deep-dive chapter)

**Files:** Create `packages/app/src/learn/voyager/pictureSignal.ts`, `packages/app/src/learn/voyager/signalDemo.ts`; modify `lessons/voyagerDeepDive.ts`, `lessonMedia.ts`, `recordScene.ts`, en/de `voyager*.ts`. Test: `test/pictureSignal.test.ts`.

- [ ] Test: `encodePicture(pixels, width)` gives per line a sync pulse then the line's brightness; `decodeLine` of an encoded line returns the line (round trip within 1/255).
- [ ] Implement encoding (sync -1, brightness 0..1 → 0..1 amplitude) and an own test picture (the cover's circle).
- [ ] `SignalDemo` (panel media `demo: 'pictureSignal'`): canvas drawing the waveform of the current line and the picture building up; a button "Play the signal" synthesizes it with Web Audio (generated in the browser, nothing loaded). Record spins at 16⅔ rpm while shown.
- [ ] Chapter `picture-in-sound` after `reading-cover`; texts en/de; run tests, lint.

### Task 2: Encounter data, photos, Voyager 2 heliopause

**Files:** `data-pipeline/src/fetchVoyagerEncounters.ts` (+ `voyager/horizons.ts` reuse), `fetchVoyagerPhotos.ts` (more ids), `extractHeliopauseData.ts` (probe parameter). Output `public/data/voyager/encounters/<probe>-<planet>.bin` ([hours from closest approach, x, y, z] km, planet-centred, ecliptic J2000, hourly ±48 h), `heliopause-voyager2.json`. Test: pipeline `test/horizons.test.ts` for the parser.

### Task 3: Mission timeline and player

**Files:** `app/src/missions/missionTimeline.ts`, `missionPlayer.ts`, `voyagerStations.ts`. Test: `test/missionPlayer.test.ts`.

- **Produces:** `Station { id, date, kind: 'milestone' | 'encounter', planet?, card }`, `MissionPlayer { play(), pause(), jumpTo(index), update(dt): MissionMoment }`, `MissionMoment { day, stationIndex, phase: 'flight' | 'fadeIn' | 'encounter' | 'fadeOut' | 'hold', progress }`.
- Tests: time runs faster far from stations; arriving at a station holds until the narrator is done; pause freezes day and phase; jumpTo stops the clip and starts the new station; without clips, pacing by text length.

### Task 4: Flight and encounter scenes

**Files:** `missions/flightScene.ts` (RouteScene + following camera), `missions/encounterScene.ts`, `missions/probeView.ts` (probe viewpoint: metres, own projection with depth scaled into [0, 0.001]). Test: `test/probeView.test.ts` (probe depth always nearer than any scene depth beyond 1 km).

### Task 5: Mission tour session and scene integration

**Files:** `missions/missionTourSession.ts`, `scene/stageSource.ts` (lesson or tour), `app/app.ts`, `tours/tourLibrary.ts` (`TourId` + 'voyager1' | 'voyager2'). Test: `test/missionTourSession.test.ts` (restore on end).

### Task 6: Card, timeline bar, fade; texts; credits; narration export

**Files:** `missions/missionCard.ts`, `missions/timelineBar.ts`, `missions/missions.css`, `index.html`, en/de `missions.ts`, `about/credits.ts`, `CREDITS.md`, `narration/narrationSegments.ts`.
- [ ] Verify: lint, typecheck, all tests, build; preview at http://localhost:5199/.
