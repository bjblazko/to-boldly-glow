# HUD: one bar and a start page

Date: 2026-11-17 · Status: approved by Timo (chat, 2026-11-17) · Click dummy: `2026-11-17-hud-one-bar-clickdummy.html` (variant A)

## Why

The interface has grown piece by piece and now feels scattered: controls in five places (beta note top left,
mode tabs top centre, four icons top right, dock bottom, plus lesson zoom/reset and the tour bar in their own
corners), two kinds of "tour" reached three ways (welcome card, Tours tab, camera panel's flyby), a camera
panel that says where it switches *to* and stays open after the click, and settings split between ⚙ and View.
Timo: "aus UX sicht alles ein wenig durcheinander … wie wir das alles einfangen".

Success: one place to look for controls, one way to start a tour, one obvious camera switch, panels that get
out of the way.

## Goals

- **One bar, bottom centre**, holding every control: ⌂ Start · Suchen · Kamera · Zeit · Ansicht · Mehr.
- **A start page (⌂)** that is the single entry to everything you can *start*: the big narrated tour (with
  language and narrator), the other tours (Voyager 1, Voyager 2), the lessons, and "Selbst erkunden".
- **Lessons and tours reuse the bar as their player**: ⌂ · ‹ chapter/station › · play/autoplay · reset view ·
  layers (Ansicht) · Mehr · leave. Lesson/tour text sits bottom left, above the bar.
- **Camera: two modes, switched in the bar** (Umkreisen | Freiflug), one click, no panel. Switching shows the
  controls overlay briefly (already built).
- **Mehr** gathers settings (language, narrator, subtitles, video, audio), About (version, project page,
  imprint, privacy, licences, compact-scale note), "Steuerung zeigen (?)" and "Oberfläche ausblenden (H)".
- **One search** (bar's Suchen and Ctrl+K) that finds bodies, lessons and tours.
- **Panel rules**: one panel open at a time; a click on the scene or Esc closes it; choosing something that
  changes the scene closes it; toggles (View layers, scale) keep it open.

## Non-goals

- No change to the scene, the camera physics, lessons' or tours' content, or narration.
- No new visual language: same glass/dichroic slabs, accents and fonts as today (see design memory: the
  HUD's own style, not Rams).

## Anti-goals (would make this a failure even if it works)

- A newcomer not finding the narrated tour, or a tour starting without a click (sound needs the click).
- Losing a function on the way (fps display, scale switch, follow/stop-following, time shuttle, lesson sort,
  chapter menu, text collapse, touch flight pad, hide UI).
- The bar crowding or wrapping off-screen on a phone.

## Decisions (Timo's)

- Variant **A** (one bottom bar) over B (left rail) and C (today's layout tidied).
- The silent endless **flyby ("Rundflug") is removed**; the narrated big tour covers it. The tour engine
  stays: the big tour and missions use it with a route.
- Two camera modes only; the camera panel goes.
- The start page opens **via ⌂**, not on every visit. Exception (proposed and accepted): on the **very first
  visit** it opens once by itself, so the tour is found; afterwards only via ⌂.

## What goes away

Welcome card and welcome pill (→ start page), top mode tabs Erkunden/Lernen/Touren (→ start page and
context), top-right icon row (search → bar, settings/about/hide → Mehr), camera panel incl. flyby button,
lesson view-controls corner (zoom/reset → bar; zoom stays on wheel/pinch), mission tour bar (→ bar), beta note
block (→ small chip top left that opens Mehr › Über).

## Approaches considered

- **A – one bar (chosen)**: everything at one edge, the bar's content follows the context. Most coherent; the
  biggest rework of `index.html`, `hud.css` and the HUD wiring.
- **B – left rail**: same consolidation, vertical; frees the bottom but fights the lesson panel and phones.
- **C – tidy only**: smallest change, keeps the split between top tabs and dock that causes the confusion.

## Left to the builder

- Phone layout of the bar (icons only and/or horizontal scroll; lesson text as the existing bottom sheet).
- Where the lesson's chapter menu and sort menu pop up (above their bar item).
- Keyboard: Tab order follows the bar; existing shortcuts (H, ?, Ctrl+K, Esc) keep working.
- Remembering "first visit seen" in localStorage alongside the existing settings (already disclosed in About:
  settings are kept in this browser only).
- Removing dead code and i18n keys of the removed pieces; e2e tests follow the new IDs.
