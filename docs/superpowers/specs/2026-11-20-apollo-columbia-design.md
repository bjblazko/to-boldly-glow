# Apollo, step 2: "Columbia" - the command and service module - design

Status: approved 2026-11-20 (decisions in chat). Second result of the Apollo plan (roadmap
"Apollo").

## Intent

A lesson on the Missions shelf about Apollo 11's spacecraft: the command module Columbia and its
service module, outside and - for the first time - inside. Outside it is our own to-scale model in
the blueprint room, the service module cut open sector by sector; inside it is the Smithsonian's
scan of the real capsule (CC0), with its instrument panels, couches and the crew's notes on the
walls.

**Non-goals**: the flight itself (TLI, docking, entry - later steps), moving switches, the lunar
module, a walk-through with free-flight controls.

**Anti-goals**: a download that makes the lesson slow to open (budget about 15 MB for the
interior), an interior so dark or so cramped that the camera clips into the walls.

## Chapters (wording left to the build)

1. **The spacecraft** - CSM whole, about 11 m long; a person for scale.
2. **Service module, cut open** - six sectors around the main engine: oxidizer and fuel tanks,
   helium, fuel cells, oxygen and hydrogen tanks.
3. **The main engine** - the SPS, the one engine that had to work: into lunar orbit and home.
4. **The command module** - heat shield, hatch, windows, docking tunnel.
5. **Inside** - the camera goes in through the hatch: the cabin as scanned.
6. **The main display console** - the panels, the guidance computer's keyboard (DSKY).
7. **Three couches** - 6 m³ for three men for eight days.
8. **Notes on the walls** - what the crew wrote and stuck inside Columbia.

## Design

**Data (pipeline)**
- `apollo/csmProfile.ts`: CM and SM dimensions from the Apollo Spacecraft News Reference (NAR,
  1968) and other NASA documents, cited per value as in `saturnVProfile.ts`; `APPROX` where none
  settles a value.
- `apollo/csmParts.ts`: exterior from the lathe builder (`latheMesh.ts`, `shapes.ts`): CM cone and
  heat shield, SM cylinder, SPS bell, RCS quads, high-gain antenna; inside the SM the six sectors'
  tanks and fuel cells as simple shapes.
- `apollo/columbiaInterior.ts`: reads the Smithsonian glb (path given on the command line, not
  committed - 40 MB; its SHA-256 in CREDITS), scales centimetres to metres, places it in the CM's
  frame, simplifies the mesh with meshoptimizer (via `@gltf-transform/functions`) to about 200k
  triangles and resizes the textures (panels 4096 px, the rest 2048 px), then writes it in the
  app's model format, one assembly per scan part (hull, panels, seats, notes).
- `buildColumbia.ts`, npm script `build-columbia`.

**App**
- `learn/apollo/columbia*`: the lesson scene on the Saturn V's pattern (`ModelScene`, blueprint
  room sized to the spacecraft, height marks), plus the interior: drawn mostly with fill light (the
  scan's textures carry their own light, as the Golden Record's photo does), the camera inside with
  a small zoom floor and free look.
- The blueprint room takes its size from the scene (64 m for the Saturn V, about 20 m here).

**Legal**: the scan is CC0 (Smithsonian 3D, item page checked 2026-11-20); credit the Smithsonian
National Air and Space Museum all the same. The crew's notes are part of the scanned object.

## Left to the builder

Simplification targets per part, the scan's registration in the CM frame, camera paths, the
interior lighting balance.
