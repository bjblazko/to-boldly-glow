# Original audio in the Apollo 11 lesson – design

Roadmap: Apollo step 7 (first part: the original audio, in the lesson). Owner's choices
(2026-11-22): first in the lesson "Apollo 11: to the Moon and back", not only in the tour; each
clip plays **automatically after Lyra's text**.

## Intent

Let the mission speak for itself at its key moments: after the narrator has explained a chapter,
the people who were there say it in their own words, in the original, with subtitles. The same
clips and the same pipeline serve the tour later (roadmap steps 8–11).

## Goals

- Six short clips (about 3–20 s each), one per key chapter:

  | Chapter | Clip | Who |
  |---|---|---|
  | `launch` | "... liftoff, we have a liftoff, 32 minutes past the hour ..." | Jack King, launch control (KSC) |
  | `tli` | "Apollo 11, this is Houston. You are go for TLI." | Bruce McCandless, CAPCOM |
  | `landing` | "Houston, Tranquility Base here. The Eagle has landed." | Neil Armstrong, Charlie Duke |
  | `surface` | "That's one small step for (a) man, one giant leap for mankind." | Neil Armstrong |
  | `liftoff` | the ascent stage's liftoff call ("... proceed ... beautiful ...") | Buzz Aldrin |
  | `splashdown` | the recovery calls after splashdown | Apollo 11, the recovery forces |

  The exact cut of each clip is settled while building, by listening; the owner hears all six
  before they ship.
- Subtitles while a clip plays: in English the words as said; in German a translation. Shown
  always, whatever the subtitles setting says: the clips are in English, and the setting is for the
  narrator.
- A line under the subtitle naming who speaks, when and where ("Neil Armstrong, 20 July 1969,
  20:17 UTC, Tranquility Base").
- A small button on the chapter's panel to hear the clip again.
- The music steps back while a clip plays, as it does for the narrator.

## Non-goals and anti-goals

- No clips outside the Apollo 11 lesson in this step; the tour comes later.
- No restored or remastered versions by third parties (their editing may carry rights); only
  NASA's own files.
- Anti-goal: a quotation that is wrong or put in the wrong mouth. Every subtitle's English matches
  NASA's raw air-to-ground transcript (no copyright asserted) and the recording; the corrected
  transcripts of the Apollo Lunar Surface and Flight Journals are copyrighted and are only used to
  check, never copied.
- Anti-goal: anything that looks like an endorsement by NASA or the astronauts.

## Approach

Considered: (1) automatically after Lyra's text – chosen by the owner; (2) only on a button – easily
missed; (3) in sync with the close-ups (e.g. at touchdown) – strongest, but tied to the animation's
timing; left for the tour.

## Design

- **Sources** (pipeline, `packages/data-pipeline/src/apollo/originalAudio.ts`): a table, one entry
  per clip: chapter, NASA source URL, start and end in the source (seconds), speakers, the time
  (UTC, mission time), the English words, the German translation. Sources in order of preference:
  NASA's "Historical Sounds" page (launch, landing, the first step), then NASA's own Apollo 11
  mission audio (air-to-ground and flight director loops, as NASA published them) for the others.
- **Fetch and cut** (`npm run fetch-apollo11-audio`): downloads each source into its own new
  directory, cuts it with ffmpeg, normalizes the loudness as the narration is (I=-16, TP=-1.5) and
  encodes it as the narration is (Opus WebM and MP3) to
  `packages/app/public/audio/apollo11/<chapter>.{webm,mp3}` with a small manifest (length, hash).
  The source files stay out of git.
- **App**: a chapter may name an original clip (`originalAudio`). `LessonNarration` plays it when
  the chapter's narration clip ends (and right away if the narrator's voice is off but sound is on);
  changing chapter cuts it, as it cuts the narrator. The subtitles are the clip's words, timed by
  length as the narrator's are (`subtitleCues`), in the bar the tour uses. The chapter's time to
  auto-advance adds the clip's length. The panel button plays it again.
- **Texts**: en/de subtitles and speaker lines in `i18n/messages/*/apollo11.ts`.
- **Credits**: each clip with its NASA source in CREDITS.md and the app's credits ("Courtesy NASA";
  NASA asks to be named as the source).

## Constraints

- The license check (`huepattl-legal-check`) before the push: each source file's page, NASA's media
  guidelines (recordings of identifiable people: fine for education, no commercial use or
  endorsement).
- Download size: six clips, a few hundred kB in all.

## Left to the builder

The exact cuts and transcript lines (listened against the recording), the button's look within the
panel's existing style, the speaker line's wording.

## Checks

Pipeline tests: the table is complete (every clip has a source, a cut inside it, speakers, a time,
English and German). App tests: every clip named by a chapter exists in the audio manifest with its
length; the clip follows the narrator and stops on a chapter change; the chapter's time includes
the clip. Lint, typecheck, the full suite; a listening check by the owner on localhost.

## Next (decided 2026-11-22)

After this step, automatically: Columbia's cockpit from Project Apollo - NASSP (`CM-VC.msh`), as
Eagle's; the Smithsonian scan stays for what it is best at (see the Columbia lesson's spec).
