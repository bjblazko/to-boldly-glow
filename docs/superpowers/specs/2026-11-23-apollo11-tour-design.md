# The "Apollo 11" tour, first version – design

Roadmap: Apollo steps 9 and 11 (camera language; the full tour), the launch (step 10) to be put in
front later. Decided by the owner 2026-11-23 (answers to questions, then the station draft: "ok").

## Intent

The whole mission at true scale on the reconstructed path (`translunar.bin`, `lunar.bin`,
`eagle.bin`, `transearth.bin`, `moon.bin`; loader `missions/apollo11/apollo11Trajectory.ts`), as a
documentary film of about half an hour: the long coasts sped up, the key moments in real time,
Lyra narrating each station (en, de) and the original audio at its place. It should *feel* like a
film - varied perspectives, the distance and loneliness of the trip, looking out of the windows,
seeing the controls that are worked when something happens.

## Goals

- Earth orbit to splashdown, 13 stations (below), some 25 minutes outside plus a buffer of 5-7
  minutes for the shots inside: about 30-32 minutes in all.
- Within a phase the camera stays on the real path with time sped up; between phases a cut behind
  a fade, the mission time (GET) shown.
- The tour cuts between outside and inside itself ("auto"); a switch: outside only / inside only /
  auto. Inside, often looking out through the windows; at the decisive moments the controls being
  worked (a switch thrown, the DSKY's lights, a lamp coming on).
- Back / next / pause and a link to each station, as in the other tours (`#tour/apollo11/<id>`).

## Non-goals (this version)

- The launch and ascent, pad 39A (step 10). The tour starts in Earth orbit.
- Tranquility Base's terrain and the things on it: built in parallel (pipeline), fitted in once the
  tour stands; until then the plain Moon.
- Crew figures inside; water and parachutes at splashdown (the tour ends with a fade at the
  splashdown's moment).

## Anti-goals

- Monotony: the same chase camera at the same distance shot after shot.
- Fakery that changes the record: positions, times and attitudes come from the reconstruction and
  the documents; where an attitude is not documented it is plausible and marked APPROX.

## Stations

| # | id | Station | GET | Pace | Length |
|---|---|---|---|---|---|
| 1 | earthOrbit | In Earth orbit | 0:12 – 2:44 | sped up, ~1.5 orbits | 1:30 |
| 2 | tli | TLI: off to the Moon | 2:44 – 2:50 | real time at ignition, then faster | 1:30 |
| 3 | docking | Transposition and docking | 3:15 – 4:17 | real time near the docking | 2:00 |
| 4 | coast | Three days' coast | 4:40 – 75:50 | much sped up | 2:00 |
| 5 | loi | Behind the Moon: LOI | 75:50 – 80:12 | sped up | 1:30 |
| 6 | undocking | Undocking | 100:12 – 101:36 | real time at first | 1:30 |
| 7 | landing | The landing | 102:33 – 102:45:40 | faster to ~102:42, then real time | 3:00 |
| 8 | firstStep | The first step | 109:24 | real time | 1:30 |
| 9 | columbiaAlone | Columbia alone | ~110 – 124 | sped up | 1:00 |
| 10 | liftoff | Lunar liftoff | 124:22 – 124:29 | real time at first | 2:00 |
| 11 | rendezvous | Rendezvous and docking | 125:20 – 128:03 | sped up, real time at the end | 2:00 |
| 12 | tei | Home: TEI | 135:24 – 195 | real time at ignition, then much sped up | 2:00 |
| 13 | entry | Entry and splashdown | 194:49 – 195:18 | sped up to entry, then real time | 2:00 |

Original audio at its station: TLI, landing, first step, liftoff (the clips of the Apollo 11
lesson). The S-IVB is shown with the stack until ejection, then falls behind.

## Camera language

Each station is a short sequence of shots; each shot has a kind, a lens and a framing. The
director picks from them so that neighbouring shots differ in distance and lens.

- **Lenses** (35 mm equivalent, as vertical field of view): ultra-wide 14 mm, wide 24 mm, normal
  50 mm, tele 200 mm, long tele 800 mm and more for the far shots.
- **Kinds**:
  - *far* - the craft tiny, lots of negative space, Earth, Moon or Sun in the frame: distance and
    loneliness (e.g. Columbia a speck over the far side; the Earth a small disc behind).
  - *wide* - the craft with its surroundings, ultra-wide close to the hull, a part of the hull as
    a foreground "interferer" (looking along the SM past an RCS quad toward the Moon).
  - *close-up* - a detail: the SPS bell lighting, the docking probe, Eagle's footpad.
  - *tracking* - riding with the craft on its path, slow drift round it.
  - *fixed* - a camera that stays in space while the craft passes (e.g. Eagle dropping past).
  - *window* - inside, looking out through a window (CM: the rendezvous windows, the hatch window,
    the side windows; LM: the two triangular front windows, the overhead docking window), the
    frame of the window and the panel edge in the picture.
  - *controls* - inside, a close-up on the controls worked at that moment (below), switches
    moving, lamps and DSKY digits lighting as in the record.
- **Backgrounds**: the Sun, Earth or Moon placed behind the craft on purpose where the geometry
  allows (the director searches the camera's position round the craft for it).
- Cuts between shots: hard cuts within a station, fades between stations.

### The controls at the decisive moments (APPROX where not documented in detail)

| Station | Inside | Controls |
|---|---|---|
| tli | Columbia | the event timer and the attitude ball (TLI was flown by the S-IVB's own guidance) |
| docking | Columbia, left rendezvous window | the hand controllers, the COAS sight on Eagle |
| loi, tei | Columbia | the SPS thrust switch, the delta-V counter running down |
| undocking, landing | Eagle | the DSKY (P63, the 1202/1201 alarms, PROCEED), the window's LPD grid, the P66 switch, the contact light, the engine stop button |
| liftoff | Eagle | the engine arm circuit breaker (the broken one, pushed in with a felt-tip pen), ABORT STAGE |
| rendezvous | Eagle overhead window; Columbia COAS | the hand controllers |
| entry | Columbia | the EMS (the g-meter), the window's glow |

## How it gets made (my calls, for the owner to correct)

- **Two depth passes**: the world (Earth, Moon, Sun, stars) at true scale, then the craft (and the
  cockpits) in a metre pass with its own depth range, the same camera - as in the Voyager
  encounters, but without enlarging the craft. Windows are holes in the cockpit's pass, the world
  shows through.
- **Models**: the vehicle lessons' outside models (Columbia, Eagle with hinged legs, Saturn V's
  S-IVB) and the NASSP cockpits (Columbia's; Eagle's own cockpit model); the controls animated as
  parts of the cockpit models where they are separate meshes, else as small overlays (a lamp, the
  DSKY's digits).
- **Attitudes**: documented where the Flight Journal has them (e.g. LOI and TEI SPS-forward
  burns, the landing's pitch-over), otherwise plausible (the passive thermal control roll on the
  coasts, APPROX).
- **Mission tour machinery**: the existing mission tour (stations, narration, back/next/pause,
  links) with Apollo 11 as its second kind of mission next to Voyager.
- **Order**: first the stations outside with a simple chase camera, so the run and its timing can
  be seen; then the shot system and the director; then inside and the controls; then the narration
  texts (en, de). The recording comes later, on the owner's word (2026-11-23: "erstelle die
  tonspuren erst spaeter, erstellt erstmal nur die texte"); until then the tour shows the texts as
  captions, as other unrecorded tours do.

## Left to the builder

The shots within each station, exact lengths, the speed-up curves, camera positions searched for
the backgrounds, which cockpit parts can move.
