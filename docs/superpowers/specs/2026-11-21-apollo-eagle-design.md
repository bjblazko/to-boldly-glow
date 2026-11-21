# Apollo, step 3: "Eagle" - the lunar module - design

Status: draft 2026-11-21 (the approach was chosen in chat: our own model from NASA dimensions). Third
result of the Apollo plan (roadmap "Apollo").

## Intent

A lesson on the Missions shelf about Apollo 11's lunar module Eagle: the first craft built only for
flying in a vacuum, outside and inside. It is our own to-scale model in the blueprint room, made in
the data pipeline from NASA dimensions, as the Saturn V and the service module are. Because it is
built from parts, it can do what the LM did: fold its legs for the ride in the Saturn V, unfold them,
come apart into its two stages, and lift the ascent stage off the descent stage, which stays behind
as its launch pad. Inside, the camera stands where Armstrong and Aldrin stood, at the two triangular
windows, in front of the panels.

**Why**: the vehicles are what every later step builds on. The descent (step 7), the ascent and
rendezvous (step 8) and the tour (step 12) all need Eagle as a model that comes apart and has an
inside.

**Non-goals**: the flight itself (the descent, the landing and the ascent are later steps); the
lunar surface (step 7); working switches; the EVA equipment (suits, PLSS, experiments) beyond what
is stowed on the outside; a photographic, scanned look.

**Anti-goals**:
- A toy. Proportions that are off, or a gold foil that looks like plastic.
- NASA insignia anywhere, or the crew's signatures from the plaque.
- A cockpit so dark or cramped that walking in clips through the walls.
- A model that cannot be reused when the descent, the ascent and the tour need it.

## Chapters (wording left to the build)

1. **Eagle**: whole, legs out, about 7 m tall and 9.4 m across the footpads, with a person for
   scale. The only crewed craft never built to fly in air.
2. **Folded for the ride**: the legs fold, and Eagle sits as it did in the adapter under the CSM.
   The legs unfold again.
3. **Two craft in one**: the stages part. The descent stage carries the landing and the ascent stage
   carries the return.
4. **Descent stage, cut open**: the four propellant tanks around the throttleable descent engine
   (DPS), the legs, the probes, the stowage bay for equipment on the Moon (MESA) and the ladder.
5. **Ascent stage**: the cabin, the two tanks either side, the fixed ascent engine (APS), the RCS
   quads and the antennas.
6. **Inside**: the camera goes in through the forward hatch. Two crew standing, held by cables, and
   no seats.
7. **The panels and the windows**: the flight displays, the guidance computer's keyboard (DSKY),
   the windows' angle down to the ground, and the overhead window for docking.
8. **Liftoff from the Moon**: the ascent stage leaves and the descent stage stays as its launch pad.
   It is still there.

## Approaches (decided)

1. **Our own model from NASA dimensions (chosen).** It is to scale and comes apart into assemblies,
   so the stage separation and the folding legs come naturally. It matches the Saturn V and the CSM.
   It costs more work because the LM is angular (octagonal and faceted), not a lathe body.
2. NASA's LM glb from nasa3d: in the public domain and quick to get, but rigid, coarse and not split
   into stages and legs. It was rejected because the separation and the leg motion would need
   rebuilding it anyway.

The cockpit is our own in both cases, as the plan says.

## Design

**Data (pipeline)**, in `packages/data-pipeline/src/apollo/`:
- `lmProfile.ts`: dimensions, cited per value as in `csmProfile.ts`.
  - Sources: the LM News Reference (Grumman, 1969), the Apollo Operations Handbook LM (LMA790-3),
    the Apollo 11 Press Kit and the Apollo 11 Mission Report. `APPROX` where no source settles a
    value.
  - Covers: the descent stage octagon, the ascent stage's faceted cabin, the tanks, the DPS and APS
    bells, the legs (primary and secondary struts, footpads, probes), the hatch, the windows, the
    tunnel and the drogue, the RCS quads, the antennas (S-band steerable, rendezvous radar, VHF),
    the MESA and the ladder.
- `lmParts.ts`: parts from the existing primitives (`latheMesh`, `plateMesh`, `strutMesh`,
  `placedLathe`, `tankProfile`), plus faceted prisms built from plates.
  - Assemblies:
    - `descent`: the shell, cut open.
    - `descentInside`: the tanks and the DPS.
    - One assembly per leg (4).
    - `ascent`: the cabin shell.
    - `ascentInside`: the tanks and the APS.
    - `cockpit`.
    - `person`.
  - That is about 11 of the 16 the renderer allows.
- `lmTextures.ts` (sharp): our own textures.
  - The descent stage's foil: gold Kapton with black and amber, crinkled, through a procedural
    height map plus colour noise.
  - The ascent stage's grey and black panels.
  - The US flag and "UNITED STATES" in block letters (`blockLetters.ts`).
  - The plaque on the front leg: its text only, no signatures.
- `lmCockpit.ts`: the cockpit as simple geometry with panel textures drawn in the pipeline (SVG to
  sharp).
  - Contents: the main panels 1 to 3, the DSKY, the flight director attitude indicators ("8-balls"),
    the crosspointers, the hand controllers and throttle, the armrests, the restraint cables, the
    alignment optical telescope (AOT), the floor and the back wall with its equipment as blocks.
  - Labels are readable at the scale you see from a standing position. They are generic copies made
    from handbook drawings, not photographs.
- `buildEagle.ts`, npm script `build-eagle`. Output goes to `packages/app/public/models/eagle/`.

**Moving parts**: the legs fold by rotating about their hinge at the descent stage.
- Today assemblies can only be shifted (explode offsets).
- The model format and shader gain one rotation per assembly about a hinge axis: a pivot point,
  an axis, and an angle that a stage sets.
- Voyager, the Saturn V and the CSM are unchanged (no hinges).
- The ascent stage's liftoff is an explode offset along +Y.

**App**:
- `learn/apollo/eagleVehicle.ts`: the vehicle config, following `columbiaVehicle.ts`: shots, labels,
  height marks, a room sized to about 12 m, and the inside frame with walking.
  - Walking starts standing upright, head toward +Y, not lying as in Columbia. You enter through
    the forward hatch.
- `learn/lessons/eagle.ts`, plus an entry in the catalog on the Missions shelf after Columbia.
- `VehicleStage` gets the leg angle, with folded and deployed as stages the scene eases between.
- i18n (en, de), the narration texts exported (listed as unrecorded until the clips exist), credits
  for the documents, a library card with a screenshot, the CHANGELOG and the roadmap.

**Legal**: all geometry and textures are our own. The dimensions come from NASA and Grumman
documents (US government works or published by NASA). The flag and the lettering are in the public
domain. The plaque text is used without the signatures. There are no NASA insignia. Run
`huepattl-legal-check` before shipping.

## Change of approach (2026-11-21, decided with the owner)

Our own model looked like a diagram next to Columbia's scan. The project was relicensed to
GPL-3.0-or-later so that Project Apollo - NASSP's lunar module (GPL-2.0-or-later) can be used: its
descent and ascent stages for the outside and its virtual cockpit (335,000 triangles, every switch
modelled) for the inside, converted by the pipeline (`apollo/nassp.ts`, `lmNassp.ts`,
`lmNasspModel.ts`) at a pinned commit. Kept from our design: the hinged legs (now found on NASSP's
struts), the cutaway's tanks and engines, the chapters, the lighting as in Columbia. Our own outside
(tag `eagle-own-model-working`) is retired.

## Left to the builder

- The exact facet layout of the ascent stage within the documented envelope.
- The look and the parameters of the foil.
- How detailed the cockpit is: readable panels in the main field of view, blocks elsewhere.
- Camera shots and paths.
- How the hinge rotation is stored in the model file.
- The leg geometry when folded.
