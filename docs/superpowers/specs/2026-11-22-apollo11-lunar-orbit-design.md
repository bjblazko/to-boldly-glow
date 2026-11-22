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

## Result so far (2026-11-22)

- Built: the Moon's orientation (IAU) and gravity field (GRAIL, converged by degree 40-60), Columbia
  from insertion to TEI in it (`lunar.bin`). Against ABTN: the 66.1 × 54.5 orbit set at
  circularization; 65.1 × 55.1 after the separation burn (63.7 × 56.0); altitudes at undocking,
  docking and jettison within 3.5 n mi; at TEI ignition 52.4 n mi within 0.1 (a point-mass Moon:
  55.9). The final separation burn's direction (not documented) taken radial, as the first was.
- Found, open: the orbit's plane misses Tranquility Base by about 3.8° (116 km), and its phase runs
  ahead (powered descent would start 23° instead of about 16° before the site). Why: the
  translunar reconstruction fixes only the pericynthion's height, not the plane relative to the
  site - which was the mission's target - and our orbit lies about 2 n mi low, so each revolution
  is some 20 s short. Next: fit the lunar orbit (its plane, phase and perilune's place at
  circularization) to all documented checkpoints plus the site passing under the powered descent's
  ground track at the documented times; then Eagle's descent (DOI solved to the documented PDI
  altitude: about 80 ft/s instead of 76.4 with today's orbit), powered descent to the site from the
  Mission Report's trajectory data and the crew's callouts (NASA's technical air-to-ground
  transcript, archive.org Apollo11Audio, AS11_TEC), ascent and rendezvous.

## Fitted over the landing site (2026-11-22)

- `apollo11LunarFit.ts`: Eagle follows Columbia to the undocking, brakes at DOI (documented
  76.4 ft/s) and coasts to powered descent; the fit turns the orbit's plane at the insertion and
  lowers the circularized orbit until Tranquility Base (LROC 0.67416° N, 23.47314° E) lies in Eagle's
  orbit plane at the landing and "about 300 miles" (taken as statute miles: 483 km, 15.9°, APPROX)
  ahead at powered descent. Solved: the plane turned 5.64°, the orbit 1.17 n mi lower than ABTN's
  66.1 × 54.5 (ABTN's orbits are a point-mass Moon's at one moment; in the field the mean orbit
  differs). Met to 0.0001° across and 0.03° along.
- Against ABTN after the fit: undocking 60.9 (62.9), after separation 62.4 × 55.6 (63.7 × 56.0),
  docking 58.7 (60.6), jettison 59.7 (61.6), and the orbit's shape near 62 × 55 to the end, as
  documented; TEI ignition 55.7 n mi (52.4) - before the fit 52.4 was met, but with an orbit of
  70 × 50, a coincidence. Ruling: the orbit over the site matters more for the tour than TEI's
  height; the transearth path (computed backward from entry) joins at TEI as before.
- Next: Eagle's powered descent (from this PDI state to the site), ascent and rendezvous.
