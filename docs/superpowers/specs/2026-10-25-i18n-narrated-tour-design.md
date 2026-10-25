# Languages and the narrated grand tour

Status: implemented on `feature/i18n-narrated-tour` (2026-10-25).

## Goals

- The app in English and German, ready for French and Spanish.
- A narrated tour: the Sun, Mercury to Neptune in order, home to Earth; at each stop about 40
  seconds of the most striking facts, spoken by a calm documentary voice on every platform.
- The voice made locally at build time by a free text-to-speech engine - no cloud service.
- A calmer camera, above all when leaving a planet.
- Later, separately: a longer tour with moons and other objects (see the roadmap).

## Languages (`packages/app/src/i18n/`)

- Per language a typed catalog (`messages/<locale>/`); English is the reference and gives the
  type, so a missing text fails `tsc`. Texts with values are functions (`(count) => ...`).
- The language is settled once as the page loads - `?lang=`, then the visitor's choice
  (`localStorage`), then the browser, else English - so module constants (lesson chapters, body
  names) can read the catalog directly. Switching reloads the page.
- `index.html` keeps its English markup with `data-i18n` / `data-i18n-attr` paths, applied before
  the app starts. Tests: catalogs have the same shape, every path exists, the markup's English
  equals the catalog's.
- Numbers through `Intl` for the locale (99.8 / 99,8).

## Camera (`packages/app/src/camera/`)

- `TourItinerary` is an interface: `NearestItinerary` (the old endless loop, for the idle start
  after 10 s) and `RouteItinerary` (the grand tour, `tour/grandTour.ts`).
- Leaving a stop: the ship circles on until it heads within 25° of the next stop, then slips out
  along the circle; over 10 seconds the gaze eases (slerp) from where it looked to where it would
  look anyway, and the turn rates of gaze and ship ramp up from 25 % and 15 %. Measured: the gaze
  turns at about 0.15–0.23 rad/s instead of 0.7, the bank stays under 4° instead of up to 15°.
- A leg's thrust covers the speed the ship set off with (the Sun's loop is large and fast).
- A route can carry `TourPacing` (lap and transit time per stop, `mayDepart`) and a
  `TourListener` (leg start, loop entry, finished). At the route's end the ship stays circling.

## Narration (`packages/app/src/narration/`)

- Scripts per language (`scripts/<locale>.ts`): per stop an `approach` (spoken from the moment the
  ship leaves the stop before, ~15 s) and an `orbit` (~30 s). Numbers below 10 as words, larger
  ones, decimals and percentages as digits.
- `Narrator` paces the tour by the clips' lengths, plays approach then orbit, and holds the ship
  until the orbit clip has ended. `AudioClipPlayer` uses one audio element (unlocked by the
  click on Start); without audio (no clip, a failed download, playback refused) it runs a clip on
  a timer, so subtitles and pace stay the same.
- Subtitles are the script text, cut into sentences (not at 99.8's point) and timed by characters.
- The welcome card (language, narrator, Start, Explore) replaces the 2-second autostart: browsers
  only play sound after a click. Left alone for 10 s it steps aside for the silent loop.
- Two narrators, Lyra and Orion; the choice is on the card and in Settings, remembered, and
  applies from the next clip.

## Synthesis (`packages/data-pipeline/narration/`)

- Qwen3-TTS (Apache-2.0): the 1.7B VoiceDesign model designs each narrator once per language from
  a description and a line in that language (an English reference gave German an English accent);
  the 0.6B Base model clones it for every clip. Fixed seed, MPS on Apple silicon, one model loaded
  at a time (the development machine has 8 GB).
- `npm run narrate` speaks only clips whose text, voice reference or model changed (hash in
  `public/narration/manifest.json`); −16 LUFS mono, as Opus 32 kbit/s in WebM and MP3 64 kbit/s;
  the app asks the browser (`canPlayType`) and loads one of them. The clips are committed; a
  unit test fails while a text lacks an up-to-date clip.

## Legal

- Qwen3-TTS code and weights Apache-2.0; its Python dependencies permissive (soxr LGPL-2.1, build
  time only); nothing of it ships. Opus is royalty-free, MP3's patents have expired; AAC was left
  out (patent pool).
- EU AI Act Art. 50: the voices imitate no real person (no deep fake), and the texts are written
  and reviewed by us; still, the About dialog and CREDITS.md say the voice is synthetic.
- The opening line quotes Star Trek's "Space: the final frontier" - a single short line.
