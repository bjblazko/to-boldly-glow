# Apollo 11 in lunar orbit, with the Moon's gravity field – design

Roadmap: Apollo step 8, first part (the owner, 2026-11-22: "erst release, dann schritt 8"; then
away: "mache ohne meine bestaetigung weiter"). The tour (steps 8-11) shows the mission at true
scale on the reconstructed path; the path so far ends at lunar orbit insertion and starts again at
transearth injection (spec 2026-11-22-apollo-mission-data-design.md). This closes the 59½ hours in
between for Columbia.

## Intent

Fly Columbia's 30 lunar orbits as they were, so the tour can show the craft where it was at each
moment - the undocking over the far side, the landing site passing below, the rendezvous - and so
the reconstruction meets the documented states along the way and the transearth path at TEI.

## Why the gravity field

A 60 n mi orbit round the Moon is not a fixed ellipse: the Moon's mass concentrations (mascons)
pull it about. ABTN's own numbers show it: 66.1 × 54.5 n mi after circularization (080:11:54),
63.7 × 56.0 after the separation burn (100:40:02), 62.7 × 54.0 at the final separation
(130:30:08), 52.4 n mi at TEI ignition (135:23:42). A point-mass Moon keeps the ellipse's shape;
the reconstruction needs the field.

## Design

- **The Moon's orientation** (`moonOrientation.ts`): the IAU WGCCRE model of the Moon's pole and
  prime meridian (Archinal et al. 2018, with its periodic terms E1-E13), giving the mean-Earth
  frame; turned into the principal-axis frame of the gravity model by DE421's small fixed rotation
  (67.92", 78.56", 0.30"). Tested: over July 1969 the point under Earth stays within the Moon's
  librations (about ±8° in longitude, ±7° in latitude) of 0°, 0°.
- **The gravity field** (`lunarGravity.ts`): NASA/GSFC's GRAIL model GRGM660PRIM (NASA PDS,
  `gggrx_0660pm_sha.tab`, public domain; downloaded once into the pipeline's cache, not committed),
  truncated to a degree that resolves the mascons at 50-110 km (about 60, checked by convergence),
  evaluated with fully normalized associated Legendre functions. Tested: degree 0 is the point
  mass; J2 alone matches the closed form; the truncation changes the 55-hour result by less than
  the documented values' rounding.
- **The orbit** (`apollo11LunarOrbit.ts`, extended): from the reconstructed state at the
  circularization burn, the burn to the documented 66.1 × 54.5 n mi; then coasting in the Earth-
  Moon-Sun system with the Moon's field; the CSM's separation burn (100:39:52.9, 2.7 ft/s radially
  down) and final separation burn (130:30:01.0, 2.2 ft/s, its direction APPROX: retrograde) as
  impulses; to TEI ignition.
- **Checks** against ABTN at each documented moment (altitude, speed, apocynthion × pericynthion)
  and against the transearth path computed backward from entry: where the two meet at TEI.
- **Output**: the lunar-orbit leg written with the other legs (`lunar.bin`), for the tour.

## Not in this part

Eagle's own path (descent, ascent, rendezvous), Tranquility Base's terrain, the tour's views: the
next parts of step 8.

## Left to the builder

The truncation degree and step size (by convergence), the burn models' details within the
documented values.
