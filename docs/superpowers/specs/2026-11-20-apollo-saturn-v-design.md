# Apollo, step 1: "The Saturn V, taken apart" - design

Status: approved 2026-11-20. First result of the long-term Apollo plan (see the roadmap's "Apollo"
entry). Narration audio may follow in a later session, as for the Voyager lessons.

## Intent

A lesson on the Missions shelf: Apollo 11's Saturn V (AS-506) as a to-scale 3D model, 110.6 m
tall, turning slowly. It comes apart into its stack, each stage can be cut open (tanks, engines,
feed lines, drawn schematically), with labels, fact cards and photos, in English and German.

The model is the foundation of everything that follows (mission lessons, launch, the cinematic
tour), so it is built to be reused: a generic lathe-mesh builder in the data pipeline, and a
renderer that can cut models open.

**Non-goals**: the launch itself (exhaust, motion), the pad and tower, a detailed LM or CSM (both
are simple placeholders inside the stack here; they get their own sessions), interiors one can
walk through.

**Anti-goals**: wrong dimensions, NASA insignia anywhere, a cutaway that looks like a bug (holes
without a visible cut edge).

## Chapters

1. **The whole rocket** - outside, a 2 m human figure at its foot for scale; a launch photo.
2. **The stack** - taken apart: S-IC, S-II, S-IVB, Instrument Unit, SLA (with the LM inside),
   service module, command module, launch escape tower.
3. **S-IC** - cut open: RP-1 and LOX tanks, five F-1 engines; thrust, burn time, propellant per
   second.
4. **S-II** - cut open: LH2 above LOX with a common bulkhead, five J-2s.
5. **S-IVB** - one J-2, fired twice: into parking orbit and for trans-lunar injection.
6. **Instrument Unit** - the ring that steers the rocket.
7. **The spacecraft on top** - the SLA opens: LM, CSM, escape tower.
8. **What comes back** - of about 2,900 t at launch only the command module (about 5.6 t); the
   parts disappear in the order they were jettisoned.

## Design

**Data (pipeline, committed)** - `packages/data-pipeline/src/apollo/`
- `saturnVProfile.ts`: stations (height, radius) of each part's outside, tank boundaries and
  domes inside, F-1 and J-2 bells as profiles, fins, fairings. Values from public-domain NASA/MSFC
  documents (Saturn V Flight Manual, Saturn V News Reference, AS-506 flight evaluation report),
  cited beside the table.
- `latheMesh.ts`: a surface of revolution from a profile (normals, u around, v along), segment
  count as a parameter; boxes and struts for fins and the escape tower. Generic: reused for CM, SM
  and LM later.
- `saturnVTextures.ts` (sharp): the paint - black and white roll pattern, "UNITED STATES", the US
  flag (public domain); no NASA insignia. Tank walls and insulation in plain colours.
- `convertSaturnV.ts`, npm script `build-saturn-v`: parts -> `packModel()` -> 
  `packages/app/public/models/saturnV/`.

NASA's own Saturn V glb is not used: low-poly, not to scale, no interior. The rocket is almost all
surfaces of revolution, so building it from dimensions is more accurate and gives the cutaway for
free.

**App**
- Model renderer: up to 16 assemblies; a **cut**: a uniform (0 to 1) and a cut plane; each
  assembly is a "shell" or "inside" (flag in the offset's w). Shells lose the fragments in front of
  the plane while cut > 0; insides show only while cut > 0; the inner face of a shell is tinted
  darker, so the cut reads as a cut. Voyager: cut 0, no insides - unchanged.
- The Voyager probe scene becomes a generic model scene (parts as a string union) used by both.
- `learn/apollo/`: stage, assets (loaded on first use), labels, shots; chapter kind
  `apolloVehicle`.
- `learn/lessons/saturnV.ts` on the Missions shelf; texts in the en and de catalogs; chapter texts
  in the narration export, listed as unrecorded.
- Credits: the documents and photos in CREDITS.md and credits.ts.

## Left to the builder

Segment counts, explode distances, camera distances per chapter, label placement, card wording.
