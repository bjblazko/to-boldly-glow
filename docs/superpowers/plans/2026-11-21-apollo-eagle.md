# Eagle (LM) Lesson Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A vehicle lesson "Eagle" (Apollo 11's lunar module): our own to-scale model from NASA
dimensions that folds its legs, comes apart into its stages, is cut open, and has a cockpit to
stand in.

**Architecture:** The data pipeline builds the model, as it does for the Saturn V and the CSM
(`apollo/lm*.ts`, `buildEagle.ts` → `public/models/eagle/`). The app gains one capability, hinged
assemblies: an assembly rotates about a pivot and axis by an angle times the stage's `fold`. The
lesson is a `VehicleLesson` vehicle config (`learn/apollo/eagleVehicle.ts`) plus a lesson file, as
Columbia is.

**Tech Stack:** TypeScript, WebGPU (WGSL), gl-matrix, Vite, Vitest, Playwright, sharp (pipeline).

**Spec:** `docs/superpowers/specs/2026-11-21-apollo-eagle-design.md`

## Global Constraints

- ESLint limits: max-lines 300 per file, max-statements 15, complexity 8, max-params 4. Split
  files by responsibility instead of exceeding them.
- Every dimension is cited per value, as in `csmProfile.ts`: the LM News Reference (Grumman, 1969),
  the Apollo Operations Handbook LM (LMA790-3), the Apollo 11 Press Kit and the Mission Report.
  Mark it `APPROX` where none settles it.
- No NASA insignia (no "meatball", no "worm"). The plaque has its text only, no signatures. The flag
  and "UNITED STATES" are allowed.
- Voyager, the Saturn V and Columbia must render and pick exactly as before. A model without hinges
  behaves identically.
- en and de texts for everything shown. Narration texts are exported; the lesson goes into
  `UNRECORDED_LESSONS` until its clips exist.
- Local headless WebGPU is broken. The look is checked by the user on http://localhost:5199/.
- Downloaded files are untrusted. No new runtime network calls.
- Commit after each task on `apollo-eagle`. End messages with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

Reference values. Verify each against the source while writing `lmProfile.ts`:

| Value | Number | Source to cite |
|---|---|---|
| Height, legs deployed | 22 ft 11 in = 6.98 m | LM News Reference |
| Diagonal across footpads | 31 ft = 9.45 m | LM News Reference |
| Descent stage height (without legs), width across the octagon | 10 ft 7 in = 3.23 m, 14 ft 1 in = 4.29 m | LM News Reference |
| Ascent stage height, width | 12 ft 4 in = 3.76 m, 14 ft 1 in = 4.29 m | LM News Reference |
| Footpad diameter | 37 in = 0.94 m | LM News Reference |
| Contact probe length | 67 in = 1.70 m | LM News Reference |
| Cabin volume | 235 ft³ = 6.65 m³ | LM News Reference |
| DPS thrust (full), throttle range | 9,870 lbf = 43.9 kN; 10 to 60 % and full | LM News Reference |
| APS thrust | 3,500 lbf = 15.6 kN | LM News Reference |
| Eagle's mass at launch | about 15,100 kg | Apollo 11 Press Kit / Mission Report |

## Review Focus

1. **A folded leg must be hit where it is drawn.** Double-click and walking collision go through
   `pickModel`. A hinge that only the shader applies would let the camera pass through folded
   legs. Task 1 tests a pick on a rotated assembly.
2. **A hinge combined with explode.** In "Two craft in one" the legs stay deployed while the
   ascent stage lifts. The rotation applies before the explode offset, about the pivot in the
   model's own frame. Task 1 tests the order.
3. **The shadow map must use the same hinge as the picture.** Otherwise folded legs cast shadows
   where the legs stand deployed. Task 1 puts the hinge transform in one WGSL function that both
   shaders use, and tests that the shadow shader source contains it.
4. **Walking inside a standing cabin.** The eye stays at least `KEEP_CLEAR` from walls. A cockpit
   about 2.3 m wide with the eye at about 1.6 m above the floor must leave room to turn. Task 5
   tests that a standing eye at the hatch has at least 0.3 m in every horizontal direction.
5. **Chapter changes between folded and deployed.** Jumping from "Folded" to "Liftoff" must ease
   `fold` back to 0 and not leave the legs half folded. Task 1 tests that the `fold` tween reaches
   the stage value, and Task 7 sets `fold` explicitly only on chapter 2 (default 0).

---

### Task 1: Hinged assemblies (app)

**Files:**
- Create: `packages/app/src/spacecraft/modelHinge.ts`
- Modify: `packages/app/src/spacecraft/modelFile.ts` (assembly `hinge?`)
- Modify: `modelScene.ts` (stage `fold`, the tween key `'fold'`, pick state)
- Modify: `modelRenderer.ts` (uniform per assembly)
- Modify: `modelShader.ts`, `modelShadow.ts` (WGSL `hinged()`)
- Modify: `modelPick.ts` (corner transform)
- Test: `packages/app/test/modelHinge.test.ts`, `packages/app/test/modelPick.test.ts`

**Interfaces:**
- Produces in `modelFile.ts`:
  `assemblies: { id; explode; kind?; hinge?: { pivot: [number,number,number]; axis: [number,number,number]; angle: number } }[]`.
  The angle is in radians at `fold = 1`.
- Produces in `modelHinge.ts`:
  - `hingeMatrix(hinge: Hinge | undefined, fold: number): Float32Array`. It returns 12 floats: three
    rows of a 3×4 affine matrix (the rotation in xyz, the translation in w), and the identity when
    there is no hinge or `fold` is 0.
  - `applyHinge(m: Float32Array, point: Vec3): Vec3`.
- Produces in `ModelStage<Part>`: `fold?: number` (0 deployed, 1 folded; eased like `explode`).
- Produces in `PickState`: `hinges: readonly Float32Array[]`. Each corner is `applyHinge`'d and then
  moved.

- [ ] **Step 1: Write the failing tests** in `modelHinge.test.ts`:
  - `hingeMatrix(undefined, 1)` is the identity.
  - A hinge with pivot `[1,0,0]`, axis `[0,0,1]` and angle `π/2` at `fold = 1` maps `[2,0,0]` to
    `[1,1,0]` (to 6 digits).
  - At `fold = 0.5` it maps `[2,0,0]` to `[1+cos45°, sin45°, 0]`.
- [ ] **Step 2: Write the failing test** in `modelPick.test.ts`, "a folded assembly is hit where it
  is drawn".
  - Use a one-triangle model with corners `[1,0,-1]`, `[2,0,-1]` and `[2,0,1]` (assembly 0), and the
    Step 1 hinge with `hinges: [hingeMatrix(h, 1)]`.
  - A ray `+X` from `[0, 0.8, 0]` hits at distance 1.
  - A ray `−Y` from `[1.8, 5, -0.5]`, where the triangle lies unfolded, hits nothing.
  - Order test: with `moved: [[0,0,3]]` as well, the ray `+X` from `[0, 0.8, 3]` hits at 1.
- [ ] **Step 3: Run** `cd packages/app && npx vitest run test/modelHinge.test.ts test/modelPick.test.ts`.
  Expected: FAIL (module missing).
- [ ] **Step 4: Implement** `modelHinge.ts` with the Rodrigues rotation about `pivot`, then
  `pickModel`. `hitOf` uses `applyHinge(state.hinges[assembly], corner)` and then adds `moved`.
- [ ] **Step 5: Renderer and shaders.**
  - The uniform gains three `vec4f` per assembly (`hinges: array<vec4f, 3 * MAX_ASSEMBLIES>`), written from
    `hingeMatrix` for each assembly with the scene's current `fold`.
  - A WGSL `fn hinged(assembly: i32, p: vec3f) -> vec3f` and `fn hingedNormal(...)` live in one
    string constant that `modelShader.ts` and `modelShadow.ts` both include.
  - Order: `hinged(p) + offset * explode`.
  - Check that the uniform buffer size stays below the 64 KiB limit.
- [ ] **Step 6: The scene.**
  - `StageTween` keys become `['explode','highlight','cut','fold']`.
  - `show()` moves `fold` to `stage.fold ?? 0`.
  - `pickState()` and `anchor()` apply the hinges.
  - Add a test in an existing modelScene test, or a new one, that after `show({fold:1})` and enough
    `update()` calls the tween's `fold` is 1, and after `show({})` it returns to 0.
- [ ] **Step 7: Run** `npm run typecheck && npm run lint && npm test` from the repo root. Expected:
  all pass, and the existing 538 app tests are unchanged.
- [ ] **Step 8: Commit** with the message "Hinged assemblies: a part of a model can fold about a
  hinge (for the LM's legs)".

### Task 2: The LM's dimensions (pipeline)

**Files:**
- Create: `packages/data-pipeline/src/apollo/lmProfile.ts`
- Test: `packages/data-pipeline/test/lm.test.ts`

**Interfaces:**
- Produces:
  - `LM_HEIGHTS`: `{ footpadBottom: 0, descentBottom, descentTop, ascentTop, overall }`, in metres,
    with y up and the footpads' soles at 0.
  - `DESCENT_STAGE`: `{ halfWidth, octagonCut, height }`.
  - `ASCENT_STAGE`: `{ facets: Point[] /* plan outline */, cabinFloor, cabinCeiling, halfWidth }`.
  - `LEGS`: an array of 4 entries, each
    `{ azimuthDegrees, hinge: Vec3, footpad: Vec3, primary: [Vec3, Vec3], secondary: [Vec3, Vec3][], foldDegrees }`.
  - `FOOTPAD = { radius, height }`.
  - `PROBE_LENGTH`.
  - `DPS`, `APS`: bell profiles (`ProfilePoint[]`) with exit diameters.
  - `DESCENT_TANKS`, `ASCENT_TANKS`: `TankShape[]`, the type from `csmProfile.ts`.
  - `HATCH`, `WINDOWS`, `OVERHEAD_WINDOW`, `TUNNEL`, `RCS_QUADS`, `ANTENNAS`, `MESA`, `LADDER`.
  - `PERSON_PLACE`.
  - Front is +Z (the forward hatch and ladder leg), up is +Y.

- [ ] **Step 1: Write the failing tests** in `lm.test.ts`:
  - `LM_HEIGHTS.overall` is 6.98 ± 0.02.
  - The footpad centres' diagonal (leg 0 to leg 2) plus one footpad diameter is 9.45 ± 0.05.
  - The descent width is 4.29 ± 0.02 and the ascent stage height is 3.76 ± 0.05.
  - The probes are 1.70 ± 0.02 long, on three legs and not the +Z ladder leg.
  - Folded per `foldDegrees`, each footpad lies within a radius of 3.3 m of the axis (the SLA's
    6.6 m), and the folded height is less than the deployed height.
- [ ] **Step 2: Run** `cd packages/data-pipeline && npx vitest run test/lm.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `lmProfile.ts` with each value cited (reference table above). Leg
  geometry: the hinge at the descent stage's upper outrigger, the primary strut to the footpad, and
  two secondary struts down to the stage's lower corners.
- [ ] **Step 4: Run the tests.** Expected: PASS.
- [ ] **Step 5: Commit** with the message "Eagle's dimensions, cited per value".

### Task 3: Textures - foil, panels, flag, plaque

**Files:**
- Create: `packages/data-pipeline/src/apollo/lmTextures.ts`
- Test: `packages/data-pipeline/test/lm.test.ts` (append)

**Interfaces:**
- Consumes: `paletteTexture`, `swatchUv`, `Rgb` from `palette.ts`, and `blockLetters.ts`.
- Produces:
  - `foilTexture(seed: number, tint: 'gold' | 'amber' | 'black'): Promise<Buffer>` (2048² JPEG,
    crinkled: value noise as a height map, shaded, plus specular streaks).
  - `lmPalette(): Promise<Buffer>` and `LM_PALETTE_TEXTURE = 'lm-palette.png'`, `LM_FOIL_TEXTURES`.
  - `plaqueTexture(): Promise<Buffer>`, with the plaque's text only.
  - `flagLettering(): Promise<Buffer>`, with the US flag and "UNITED STATES".

- [ ] **Step 1: Write the failing tests:**
  - `foilTexture(1,'gold')` decodes (sharp metadata) to 2048×2048.
  - The same seed gives the same bytes.
  - Its mean colour is gold (r > g > b, r > 150).
  - `plaqueTexture()` decodes and is wider than tall.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - The foil is crinkled with folds at several scales and a little sheen, not plastic.
  - The plaque text is the inscription "Here men from the planet Earth first set foot upon the
    Moon, July 1969, A.D. We came in peace for all mankind." in block lettering, plus the two
    hemispheres as outlines. No signatures.
- [ ] **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: Commit** with the message "Eagle's foil, paint, flag and plaque as our own textures".

### Task 4: The outside's parts

**Files:**
- Create: `packages/data-pipeline/src/apollo/lmParts.ts`
- Create: `apollo/lmLegs.ts`, so that `lmParts.ts` stays under 300 lines
- Test: `packages/data-pipeline/test/lm.test.ts` (append)

**Interfaces:**
- Consumes: the Task 2 profile, the Task 3 textures, and `latheMesh`, `plateMesh`, `strutMesh`,
  `placedLathe`, `tankProfile`, `mergePrimitives`.
- Produces:
  - `LM_ASSEMBLIES = ['descent','descentInside','leg0','leg1','leg2','leg3','ascent','ascentInside','cockpit','person'] as const`
    and the type `LmAssembly`.
  - `lmAssemblyKind(a)`: `descent` and `ascent` are 'shell'; `descentInside`, `ascentInside` and
    `cockpit` are 'inside'; the rest are 'solid'.
  - `lmExplodeOffset(a)`: `ascent`, `ascentInside` and `cockpit` are `[0, 2.5, 0]`; the rest are 0.
  - `lmHinge(a)`: for `leg0` to `leg3`, `{ pivot: LEGS[i].hinge, axis: tangent at its azimuth, angle: foldDegrees in radians }`.
  - `lmParts(): Map<LmAssembly, MeshPrimitive[]>`, without the cockpit (Task 5).

- [ ] **Step 1: Write the failing tests:**
  - The merged bounds' height is 6.98 ± 0.05.
  - Each `leg*` is non-empty and has a hinge.
  - Every primitive's assembly is in `LM_ASSEMBLIES`, and there are at most 16.
  - The ascent shell lies entirely above `LM_HEIGHTS.descentTop - 0.05`.
  - Applying `lmHinge('leg0')` at `fold = 1` (use `hingeMatrix` from the app, imported as
    `csm.test.ts` imports app types) puts every vertex of `leg0` within a radius of 3.3 m.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - The descent stage is an octagonal prism from plates (foil), with the four tanks and the DPS
    inside it.
  - The ascent stage is a faceted cabin from plates, plus the tunnel and drogue, the windows (dark
    glass), the hatch, the RCS quads, the antennas (rendezvous radar dish, S-band steerable,
    VHF), the APS and the two tanks.
  - The legs are struts, footpads (lathe) and probes.
  - The MESA, the ladder on leg0 (+Z), the flag and the lettering, and the plaque on the ladder
    strut.
  - The person comes from `PERSON` in `saturnVProfile.ts`.
- [ ] **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: Commit** with the message "Eagle outside: descent and ascent stage, legs that fold,
  tanks and engines".

### Task 5: The cockpit

**Files:**
- Create: `packages/data-pipeline/src/apollo/lmCockpit.ts`
- Create: `apollo/lmPanels.ts`, the panel textures from SVG through sharp
- Test: `packages/data-pipeline/test/lm.test.ts` (append)

**Interfaces:**
- Produces:
  - `cockpitParts(): MeshPrimitive[]` (assembly 'cockpit').
  - `cockpitTextures(): Promise<Map<string, Buffer>>`, with files `lm-panel-*.jpg`, the main panels
    at 4096 px.
  - `COCKPIT = { floor: number; eye: number; hatchInside: Vec3; hatchOutside: Vec3; standing: Vec3[] /* CDR left, LMP right */ }`.

- [ ] **Step 1: Write the failing tests:**
  - Every cockpit vertex lies inside the ascent stage's outline.
  - `COCKPIT.eye - COCKPIT.floor` is 1.55 to 1.75.
  - A standing eye at `hatchInside` has at least 0.3 m in 8 horizontal directions before the first
    cockpit or ascent triangle. Write a small ray test helper in the test that uses the app's
    `pickModel` on a packed model.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Panels 1 to 3 in front, readable at about 0.8 m: the 8-balls, the crosspointers, tapes, the
    switch rows as drawn switches with relief from a normal-free shaded texture, and the DSKY.
  - The two triangular windows above them, with the windows' angle down to the ground. The
    overhead window over the CDR.
  - The hand controllers, throttle, armrests, restraint cables and the AOT.
  - The floor, the back wall's equipment as blocks, and the lights.
  - Draw panel layouts after the handbook's drawings, but generic, with no photographs.
- [ ] **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: Commit** with the message "Eagle cockpit: panels, windows, controls, standing room".

### Task 6: The build

**Files:**
- Create: `packages/data-pipeline/src/buildEagle.ts`
- Modify: `packages/data-pipeline/package.json` (script `build-eagle`)
- Output: `packages/app/public/models/eagle/lm.{json,bin}`, `lm-*.png/jpg`

**Interfaces:**
- Produces:
  - `lm.json`, with `assemblies[i].hinge` for the legs.
  - `marks` = `{ descent: LM_HEIGHTS.descentTop, ascent: LM_HEIGHTS.ascentTop }`.
  - Anchors for every assembly but the person, plus `panels`, `windows` and `dsky` anchors for the
    cockpit's labels.

- [ ] **Step 1: Implement** `buildEagle(out)` following `buildColumbia.ts`'s `outside()`, with one
  model (the cockpit is the 'inside' assembly of the same model, so it lifts with the ascent stage).
- [ ] **Step 2: Run** `cd packages/data-pipeline && npm run build-eagle`. Expected: it logs the
  vertices, triangles and MB. Note the sizes. The target is under about 25 MB in total; looks come
  first.
- [ ] **Step 3: Add a test** in `lm.test.ts` that reads the written `lm.json`: 10 assemblies, 4 with
  `hinge`, and anchors `panels`, `windows` and `dsky` present.
- [ ] **Step 4: Commit** the model files and the script with the message "Eagle built: lm model and
  textures".

### Task 7: The vehicle in the app

**Files:**
- Create: `packages/app/src/learn/apollo/eagleVehicle.ts`
- Modify: `learn/vehicle/vehicleStage.ts` (`VehicleId` gets `'eagle'`)
- Modify: `app/app.ts` (the `eagle: EAGLE` entry)
- Modify: `i18n/messages/{en,de}/eagle.ts` (parts and marks, as in `columbia.ts`)
- Test: `packages/app/test/vehicleCamera.test.ts` (append)

**Interfaces:**
- Consumes: `eyeLookingAt`, `VehicleFrame` and `CREW_LYING`'s shape from `columbiaVehicle.ts`.
- Produces:
  - `EAGLE: VehicleConfig`.
  - `EaglePart = LmAssembly | 'panels' | 'windows' | 'dsky'`.
  - Shots: `whole`, `folded`, `stages`, `descent`, `ascent`, `inside`, `panels`, `liftoff`.
  - `STANDING = { head: [0,1,0], through: [HATCH_OUTSIDE, HATCH_INSIDE] }`, from `COCKPIT` (copied
    as constants with a comment naming `lmCockpit.ts`).
  - The `inside` frame has fov 75° and walks standing.
  - The room is sized to about 12 m, and `occlusionReach` is about 0.3.

- [ ] **Step 1: Write the failing test:**
  - `EAGLE.shot('inside')` has `walk.head` `[0,1,0]` and a `through` path that ends inside the
    ascent stage's outline.
  - `EAGLE.shot('panels')` looks toward +Z: the eye's z is less than the target's z.
- [ ] **Step 2: Run it.** Expected: FAIL.
- [ ] **Step 3: Implement** following `columbiaVehicle.ts`.
- [ ] **Step 4: Run** typecheck, lint and test. Expected: PASS.
- [ ] **Step 5: Commit** with the message "Eagle as a vehicle: shots, walking in standing up".

### Task 8: The lesson

**Files:**
- Create: `packages/app/src/learn/lessons/eagle.ts`
- Modify: `lessonCatalog.ts` (after Columbia)
- Modify: `i18n/messages/{en,de}/eagle.ts` (title, chapters, facts, captions, note)
- Modify: `{en,de}/lessons.ts`
- Modify: `narration/narrationSegments.ts` (`READ_LESSONS` and `UNRECORDED_LESSONS` get 'eagle')
- Modify: `data-pipeline/src/exportNarrationTexts.ts` if it lists lessons
- Create: `packages/app/e2e/eagleLesson.spec.ts`, following `columbiaLesson.spec.ts`

**Interfaces:**
- Consumes: `EaglePart` and the shots from Task 7.
- Produces: `EAGLE_LESSON: Lesson`, with id `'eagle'` and these chapters:

| Chapter | Stage |
|---|---|
| `whole` | `heights`, labels `descent`, `ascent`, `person` |
| `folded` | `fold: 1`, labels `leg0` |
| `stages` | `explode: 1`, labels `descent`, `ascent` |
| `descent` | `cut: 1`, highlight `descentInside` |
| `ascent` | `cut: 1`, highlight `ascentInside` |
| `inside` | `cut: 1`, `still`, `gone` = the outside assemblies |
| `panels` | as `inside`, shot `panels`, labels `panels`, `dsky`, `windows`, `closingShot: 'inside'` |
| `liftoff` | `explode: 1`, `gone: ['person']`, highlight `ascent` |

- Facts (cited in the texts): height and width, the mass about 15.1 t, DPS 43.9 kN throttled
  10 to 60 %, APS 15.6 kN, the cabin's 6.65 m³.
- Narration: a few sentences per chapter, en and de, in Lyra's voice as in `columbia.ts`.

- [ ] **Step 1: Run** the existing catalog and narration tests after adding the lesson
  (`npx vitest run test/lessonNarration.test.ts`, and the i18n completeness test if present).
  Expected: PASS once en and de match.
- [ ] **Step 2: Write** `eagleLesson.spec.ts`: open the lesson, page through all chapters, and check
  there are no console errors.
- [ ] **Step 3: Run** `npm run typecheck && npm run lint && npm test`. Expected: PASS. Run
  Playwright with `--workers=1` for the new spec. If local WebGPU fails as known, note it and leave
  it to CI.
- [ ] **Step 4: Commit** with the message "Eagle lesson: eight chapters, en/de, narration texts".

### Task 9: Credits, docs, look check

**Files:**
- Modify: `CREDITS.md`, `about/credits.ts`, `i18n/messages/{en,de}/credits.ts` (the documents)
- Modify: `CHANGELOG.md` (Unreleased), `docs/roadmap.md` (step 3 done, with the date)
- Modify: the memory `project_apollo.md`

- [ ] **Step 1: Add** the credits for the documents (LM News Reference, the AOH, the Press Kit and
  the Mission Report) with their URLs. Run the credits test.
- [ ] **Step 2: Docs.** Update the CHANGELOG and the roadmap.
- [ ] **Step 3: Ask** the user to look at http://localhost:5199/: the foil, the folding, the
  separation and walking in the cockpit. Fix what they report.
- [ ] **Step 4: Library card.** Take the screenshot `docs/images/lesson-eagle.jpg` once the user
  likes the look (from their browser).
- [ ] **Step 5: Commit.** Before any push or deploy, run `huepattl-legal-check`.
