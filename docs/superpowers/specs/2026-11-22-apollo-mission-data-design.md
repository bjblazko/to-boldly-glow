# Apollo, step 5: mission data - Apollo 11's timeline and its path to the Moon - design

Status: written 2026-11-22 while the owner was away ("as far as you get, unattended"); the calls
below are mine, marked as such, for the owner to check.

## Intent

The data every later Apollo step stands on: Apollo 11's events to the second in mission time
(GET), and its path from Earth orbit to the Moon in the Earth-Moon system - not drawn by hand but
reconstructed from the documented state at translunar injection and checked against the documented
values along the way. Step 6 (the lesson from launch to lunar orbit) and the tour draw it.

**Non-goals (this step)**: the lunar orbit, the descent and ascent, the way home (later steps,
same method); any app scene (step 6).

**Anti-goals**: a path tuned until it merely looks right; numbers without a source.

## Sources (public domain)

- ABTN: "Apollo by the Numbers", NASA SP-4029 (Orloff, 2000), archive.org item
  `apollo-by-the-numbers`: the Apollo 11 timeline and trajectory tables (GET, altitude,
  space-fixed velocity, flight-path angle, heading; parking orbit 100.4 x 98.9 n mi, 32.521 deg;
  after the S-IVB's second burn 31.386 deg; TLI at 002:50:13.03: 180.581 n mi, 35,545.6 ft/s,
  7.367 deg, 60.073 deg E of N; checkpoints at 003:15:23, 003:24:03.7, 004:40:01.72,
  026:44:58.64; LOI ignition 075:49:50.37 at 86.7 n mi and 8,250.0 ft/s).
- MR: "Apollo 11 Mission Report" (MSC-00171), archive.org item `apollo-11-mission-report`: TLI
  longitude 164.84 deg W (table 7-II); the TLI pericynthion 896.3 n mi before the midcourse correction.
- JPL Horizons: the Moon's and the Sun's geocentric positions (ICRF, DE441) for July 1969 - the
  same service the Voyager paths come from.

## Approach (my call)

1. **Timeline**: `missions/apollo11/apollo11Events.ts` - the events with their GET (seconds) and
   source; UTC from liftoff (13:32:00.63 UTC, 16 July 1969). Tested against independent times
   (landing 20:17:40 UTC, first step 02:56 UTC on 21 July).
2. **Reconstruction in the pipeline** (`data-pipeline/src/apollo/trajectory/`):
   - Force model: Earth (point mass + J2), the Moon and the Sun from Horizons positions
     (interpolated), RK4 with small steps.
   - TLI state from ABTN/MR: geocentric latitude derived from the post-TLI inclination and heading
     (cos i = cos(lat) sin(heading)); Earth-fixed to inertial by GMST and the IAU 1976 precession
     to J2000.
   - Shooting: the two least certain inputs (the TLI longitude and latitude, by fractions of a
     degree) are solved so that the coast meets the documented LOI ignition altitude and speed at
     its GET; the midcourse correction's 20.9 ft/s is applied along the velocity.
   - Validation on values not fitted: altitude and speed at 003:15:23, 004:40:01.72 and 026:44:58.64
     (ABTN), and the pericynthion before the correction (MR 896.3 n mi), each within stated
     tolerances in the tests.
3. **Output**: `public/data/apollo11/translunar.bin` (GET seconds, position km in the geocentric
   J2000 frame, thinned to a tolerance), plus the Moon's positions over the same span.

## Left to the builder

Step sizes, the thinning tolerance, the file layout, how the parking orbit before TLI is drawn
(propagated back from TLI).
