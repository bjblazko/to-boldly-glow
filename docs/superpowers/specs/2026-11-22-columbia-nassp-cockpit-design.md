# Columbia's cockpit from Project Apollo - NASSP – design

Decided in conversation 2026-11-22 ("ok, nassp-cockpit später" … "weiter mit columbia"), as Eagle's
cockpit was (spec 2026-11-21-apollo-eagle-design.md).

## Intent

The Columbia lesson's cabin is the Smithsonian's scan: real, but soft, and as the capsule is today in
the museum. Show the cabin as it flew - every switch sharp - with NASSP's virtual cockpit, and keep
the scan for what only it can show: the real capsule as it is now, and the crew's notes on its walls.

## Where each cabin is used

| Chapter | Cabin |
|---|---|
| Inside, the main display console, the three couches | NASSP's cockpit (`CM-VC.msh`, couches `CM-VC-SeatsUnfolded.msh`) |
| New: "Columbia today" (before the notes) | the scan: the real cabin as it is today |
| Notes on the walls | the scan |
| The spacecraft, service module, engine, command module (outside) | our own model, unchanged (the cutaways need it) |

## Design

- Pipeline: NASSP's two meshes at the pinned commit (GPL-2.0-or-later, already credited), turned
  into the command module's frame - NASSP's axis (its z) is our Y, its side hatch (+y) our +Z, x
  stays (Orbiter's left-handed frame turned into our right-handed one); raised so its heat-shield
  shoulder (z -0.8) lies on ours (`cmBase` + 0.47 m). Assemblies: `vcPanels` (switches, breakers,
  meters, displays), `vcHatches`, `vcCouches`, `vcCabin` (the rest). Textures as JPEG like Eagle's
  (`nasspTexture`), into `public/models/columbia/nassp/`. Written as a third model,
  `models/columbia/cockpit.*`.
- App: the Columbia vehicle gets the cockpit model with its own lamps (the console's floodlights)
  and materials; the NASSP chapters hide the scan's parts, the scan chapters NASSP's. New camera
  frames for the NASSP chapters, measured on the built cockpit.
- Texts: "Inside" says what is shown now (the cabin as it flew, NASSP's model); "Columbia today" new
  (en, de); the lesson's note names both. Narration for the two changed chapters.

## Checks

Pipeline tests: the frame (the side hatch at +Z, the forward hatch on the axis above the couches,
everything inside our command module's hull radius); assemblies present. App: lesson tests as
before (texts, narration manifest, credits), lint, typecheck; a look by the owner on localhost.

## Left to the builder

The exact camera frames, lamp places and strengths, the label anchors.
