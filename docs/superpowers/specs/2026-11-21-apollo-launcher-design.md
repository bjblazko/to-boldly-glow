# Apollo, step 4 (first part): the launch tower and the crawler - design

Status: approved in chat 2026-11-21 (blueprint room now; pad 39A and the outdoor scene later).

## Intent

A vehicle lesson on the Missions shelf, after Eagle: the Saturn V on its mobile launcher with the
launch umbilical tower, the swing arms, the hold-down arms, the crawler-transporter that carried
the whole stack to the pad - and the moment before liftoff, when the arms swing away. In the
blueprint room like the Saturn V, Columbia and Eagle. The pad itself (39A) needs the outdoor scene
and comes with it later.

**Why**: the launch (tour step 11) and the rollout need the tower; the lesson explains how the
rocket was serviced, boarded and released.

**Non-goals**: pad 39A, the VAB, terrain and sky, the mobile service structure, animations beyond
one fold (all arms swing together).

## Approach (decided)

Project Apollo - NASSP's models (GPL-2.0-or-later, the pinned commit Eagle uses): `Saturn5ML.msh`
(the mobile launcher, tower, nine service arms, crane, masts) and the crawler
(`Crawler_Mainbody.msh` + four `Crawler_drivetrucks.msh`), converted as Eagle's are. NASSP's own
animation data (`src_launch/ML.cpp`) gives the arms' pivots and angles: service arms 71 degrees
about the tower's vertical line, the crew access arm 195 degrees, the damper arm 90 degrees, the
three tail service masts 72 degrees about their tilted axes; the crawler holds the launcher 6.3 m
up (`Crawler.cpp`). Our own Saturn V (`saturnVParts.ts`) stands on the hold-down arms, as one
assembly.

## Design

- Pipeline: `apollo/launcherNassp.ts` (sort groups into assemblies, hinges from NASSP's
  animation data, mirrored into our frame), `buildLauncher.ts` -> `public/models/launcher/`:
  `launcher.*` (launcher base, tower, crew arm, service arms, intertank arm, damper arm, three
  masts, hold-down arms, the rocket, a person) and `crawler.*`.
- Frame: the rocket's axis at the origin (the hold-down arms' middle), the launcher's bottom on the
  floor; x mirrored (Orbiter is left-handed), hinge angles negated with it.
- On the crawler: the launcher, tower, arms and rocket rise by the crawler mesh's height (6.21 m;
  NASSP's attachment numbers would sink the launcher 0.3 m into it) as an explode offset; the
  crawler, placed by NASSP's attachment points (Crawler.cpp, ML.cfg), shows only in that chapter.
- The rocket stands with its first stage's base on the deck, the hold-down arms round it, so the
  command module's hatch meets the crew access arm's white room (the tower's 320-ft level).
- App: `learn/apollo/launcherVehicle.ts`, `learn/lessons/launcher.ts`, i18n en/de, narration,
  NASA photos (rollout, Apollo 11 on the pad), credits.

## Chapters (wording left to the build)

1. Rocket and tower: 110.6 m of rocket beside a 398-ft tower; the launcher base, a person.
2. The umbilical tower: 18 platforms, two elevators, the hammerhead crane.
3. Nine arms: fuel, power and air into the rocket; the crew access arm with the white room.
4. Held down: four hold-down arms keep the rocket on the ground 8.9 s after ignition.
5. The crawler: 6 million pounds, 131 x 114 ft, 1 mph with the stack, 3.5 miles, level within
   10 arc minutes.
6. Liftoff: the arms swing away, the masts fold, the rocket is released.

Facts from NASA/MSFC's "Saturn V News Reference" (December 1968).

**Legal**: NASSP GPL-2.0-or-later (as Eagle); NASA photos public domain, captions checked;
`huepattl-legal-check` before shipping.
