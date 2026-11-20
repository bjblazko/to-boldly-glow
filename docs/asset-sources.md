# Asset sources: 3D models, spacecraft media and mission data

Which sources To Boldly Glow may take 3D models, images, audio and mission data from, and on what
terms. Researched 2026-11-15 with the `huepattl-legal-check` skill; engineering guidance, not legal
advice. Re-check a source's terms when you actually take a file from it, and record each file in
`CREDITS.md` and `packages/app/src/about/credits.ts` as usual (§5 of the MVP spec).

## Rules of thumb

1. **NASA's own material is fine to bundle**: "generally not subject to copyright in the United
   States", educational use explicitly allowed, credit NASA as the source
   ([NASA Images and Media Usage Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/)).
   JPL: "may be used for any purpose without prior permission", credit
   "Courtesy NASA/JPL-Caltech" unless the caption says otherwise
   ([JPL Image Use Policy](https://www.jpl.nasa.gov/jpl-image-use-policy)).
2. **Except**: the NASA insignia ("meatball"), the "worm" logotype and the JPL logo are *not* public
   domain - none in our renders, models (check their textures), icons or screenshots. No wording
   that implies NASA/JPL endorses the app. A NASA photo in which one of them merely appears (on a
   test stand, a building, a suit) is fine to show: that is reproducing the photo, not using the
   insignia as an emblem. Do not crop or frame such a photo so the logo becomes its subject.
3. **Third-party material on NASA sites stays third-party.** A caption naming another owner
   (ESA, a university, a photographer, "© ...") means: not ours to bundle. Check every single file's
   caption, not just the site.
4. **Recognisable people** (astronauts, engineers in photos): fine for education, no promotional use.
5. **Never** a file whose license forbids modification (CC ...-ND): converting a model to our format
   is a modification. NonCommercial (CC ...-NC) only if the project stays non-commercial - avoid it
   so the option stays open. ShareAlike (CC BY-SA) is fine for an asset file; the converted file
   then carries BY-SA too, the MIT code is unaffected.
6. **Text in our own textures** is drawn with our own shapes (e.g.
   `packages/data-pipeline/src/apollo/blockLetters.ts`), not rendered from a system font: no
   font's glyphs ship with the app, and the textures come out the same on every machine.

## Sources

| Source | What | Terms | Verdict |
|---|---|---|---|
| [NASA 3D Resources](https://science.nasa.gov/3d-resources/) / [github.com/nasa/NASA-3D-Resources](https://github.com/nasa/NASA-3D-Resources) | Spacecraft, rovers, telescopes, asteroids; glb, 3ds, blend, stl | NASA guidelines (rule 1); the repo itself has no LICENSE file - the guidelines are the license | **First choice.** Check each model for logo textures and for a non-NASA credit |
| NASA Photojournal / JPL images (PIA numbers) | Mission photos, e.g. Voyager's Pale Blue Dot, Family Portrait, planet flyby images | JPL policy (rule 1); some PIA entries credit ESA or others | **Yes**, per-image caption check |
| NASA PDS (Planetary Data System), SPDF/CDAWeb, COHOWeb | Raw and calibrated instrument data (e.g. Voyager magnetometer, plasma, cosmic rays; images) | US government data, public domain; cite the dataset | **Yes**, cite dataset DOI/ID |
| [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) | Ephemerides of probes and bodies (trajectories) | No redistribution restriction found; suggested citation: "Giorgini, JD and JPL Solar System Dynamics Group, NASA/JPL Horizons On-Line Ephemeris System, data retrieved YYYY-MON-DD." | **Yes**, fetch at build time, bundle, cite. No live calls from the browser without the consent design of the "Live module" roadmap entry |
| [Smithsonian Open Access 3D](https://3d.si.edu/cc0) | Scans of real artifacts (e.g. Apollo 11 command module, Shuttle Discovery); glb/gltf/obj | **CC0** where marked; not every object is CC0 | **Yes** for items marked CC0; check the object's own page |
| [ESA](https://www.esa.int/Services/Creative_Commons_Attribution-ShareAlike_3.0_IGO_CC_BY-SA_3.0_IGO_licence) | Images, videos, some shape models (e.g. comet 67P) | **CC BY-SA 3.0 IGO** only where expressly stated; credit + link to license text | **Yes, item by item**; ESA spacecraft models: none confirmed under CC yet |
| JAXA, ISRO, CNSA | Images, some models | Own terms per site, often no open license | **Ask/verify each**; not before checked |
| Sketchfab, CGTrader, Free3D, TurboSquid | Community models, also of real spacecraft | Per model: CC0/CC BY ok; CC ...-ND/NC and "royalty free" store licenses (usually forbid redistributing the model file itself) not | **Only CC0/CC BY**, and only if the uploader is the author (NASA re-uploads by third parties: take the NASA original instead) |
| Wikimedia Commons | Images, some models | Per file; `{{PD-USGov-NASA}}` ok, others per tag | **Yes**, per file - as already done for the moon textures |
| Celestrak | TLEs for Earth satellites | Free to republish (roadmap "ISS" entry) | **Yes** |

## Voyager, concretely

**In use since 2026-11-15** (see CREDITS.md for files and hashes): NASA's "Voyager Probe (B)" model,
with its NASA-logotype sticker painted over; NASA/JPL photos of the record's cover and label;
six Photojournal photos; JPL Horizons trajectories; SPDF's Voyager 1 merged data. All of it is
bundled - the app makes no network request for Voyager. The only way out is a plain, marked link
to NASA's Golden Record page (new tab, no referrer, a note that it leaves the app).

- **Models**: NASA 3D Resources has `3D Models/Voyager Probe (A)/Voyager Probe (A).glb` (286 kB),
  `3D Models/Voyager Probe (B)/Voyager Probe (B).glb` (1.7 MB) plus an antenna-only glb, and a
  printable part-by-part set in `3D Printing/Voyager/*.stl` (bus, dish, booms, instruments, legs -
  useful for an exploded view). NASA terms, bundling ok after a texture check for logos.
- **Trajectory**: Horizons (Voyager 1 = `-31`, Voyager 2 = `-32`), sampled at build time; the
  flyby dates and distances are facts.
- **Photos and measurements**: Photojournal (PIA) and PDS/SPDF - bundle, with per-file credit.
- **Golden Record - the catch**:
  - The record's *cover* and its engraved diagrams (pulsar map, hydrogen transition, playing
    instructions) are NASA/JPL works: bundle, or redraw them as our own vector art.
  - The record's **115 images are third-party copyright**. NASA's own page: "All of these images
    are copyright protected. Reproduction without permission of the copyright holder is
    prohibited." and shows only a subset
    ([Golden Record images](https://science.nasa.gov/mission/voyager/golden-record-contents/images/)).
    **Not bundleable.**
  - The **music** (e.g. Bach, Chuck Berry's "Johnny B. Goode", Blind Willie Johnson) is in the
    specific *recordings*' copyright, many still protected (EMI famously refused the Beatles).
    **Not bundleable.** The track list itself (titles, performers, lengths) is fact: fine to show.
  - **Greetings and sounds of Earth**: recorded for the project, but the rights of the speakers and
    the sound libraries are not documented on NASA's pages. **Treat as not bundleable** unless a
    file-level public-domain statement is found.
  - What works: show the record as a 3D object with our own rendering of the cover, list the
    contents as text (titles, languages, image subjects), and link out to NASA's pages for
    the images and audio - with the consent/privacy rule for any embedded third-party player
    (better: plain links, no embeds).
