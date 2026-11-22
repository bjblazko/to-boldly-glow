# Lesson "Apollo 11: to the Moon and back" (schematic) – design

Roadmap: Apollo step 6. Approved in conversation 2026-11-22 ("ja passt").

## Intent

Show how the mission went, from launch to splashdown, so it can be followed at a glance: where the
craft went and why the path has that shape. The owner decided (2026-11-22) that lessons about how
the mission ran **explain schematically, as the Moon phases lesson does**. The full mission at true
scale, on the reconstructed path, is a separate **tour** (roadmap steps 8–11).

## Goals

- One lesson, 11 chapters, launch to splashdown, in the "Missions" shelf after Eagle.
- Earth and Moon as real lit globes, in their true size ratio, drawn much closer together than they
  are (the lesson's note says by how much). The path is drawn plainly: the parking orbit, the way
  out, the figure eight of the free return, the lunar orbit, the way home.
- A marker for the craft (and for Eagle while it flies on its own) moves along the path, chapter by
  chapter. Each chapter's times and figures come from the event timeline (`apollo11Events.ts`) and
  the mission report.
- en/de texts, narration (Lyra and Orion), the photos already in the app.

## Non-goals and anti-goals

- No true scale, no true path and no moving Moon: that is the tour's job. The reconstructed data
  (`translunar.bin`, `transearth.bin`) is not used here.
- No vehicle models in this scene: at this scale they would be invisible or misleading. The vehicle
  lessons show them.
- Anti-goal: a diagram that teaches something wrong: the direction of travel around Earth
  (prograde), around the Moon (retrograde, as Apollo flew), the far-side arrival and the Moon's
  phase must be right even though the distances are not.

## Approach

Considered: (a) the scale tour's scene with the camera moved around: rejected by the owner for
lessons; (b) the phases lesson's staged Earth/Moon with a hand-drawn route: chosen; (c) a 2D
animated chart in the panel: loses the lit globes and the camera.

## Design

- **Stage** (my call): Earth (radius 2 units, tilted, slowly turning) and the Moon (true size
  ratio) 24 units apart (12 Earth radii; really 60: five times closer), placed far out on the Sun's
  +X side as in the phases lesson, so sunlight comes from one side. The Moon stands where it was:
  about 75° past new moon (a waxing crescent seen from Earth), so Tranquility Base has its low
  morning sun.
- **Path** (pure geometry, tested): five legs in the ecliptic plane, parametrized 0–1 each:
  `ascent` (Florida up to orbit), `parking` (1.5 turns, prograde), `outbound` (from the injection
  on the side away from the Moon to arrival behind the Moon), `lunarOrbit` (retrograde, several
  turns) and `homebound` (from behind the Moon to entry and the Pacific). The legs join without a
  gap; the path stays outside both globes except where it starts and ends on Earth. The free return
  (the path the craft would have taken without lunar orbit insertion: round the Moon's far side and
  back to Earth) is drawn as a ghost in the coast chapter.
- **Eagle** has its own short path: from the orbit down to the landing site (about 23° east of the
  point under Earth, on the near side) and back up.
- **Chapters** set a stage: the view (`earth`, `whole`, `moon`), where the craft moves from and to
  (an overall progress), optionally Eagle's progress and the free-return ghost. On entering a
  chapter the marker travels its stretch in a few seconds, then holds; the camera flies when the
  view changes. The flown part of the path is bright, the rest dim.
- **Overlays**: lines (path, ghost, markers), labels for the craft (Apollo 11 / Columbia / Eagle) and
  for the burns where they happen (TLI, LOI, TEI).
- **Chapters**: 1 launch, 2 parking orbit, 3 translunar injection, 4 transposition and docking,
  5 three days' coast (free return), 6 lunar orbit insertion, 7 undocking and descent, 8 on the
  Moon, 9 ascent and rendezvous, 10 the way home, 11 entry and splashdown.
- **Photos** (all already in the app, NASA): launch, Eagle in lunar orbit, Eagle at Tranquility,
  the rendezvous, splashdown.

## Left to the builder

The exact curve shapes, label placement, colours (from the overlay palette), camera distances.

## Checks

Unit tests on the geometry (joins, radii, direction of travel, no path through a globe, far-side
arrival, landing site on the near side), lesson tests as for the other lessons (texts in both
languages, narration manifest), lint, typecheck, a real render via `npm run screenshots`.
