# Camera controls: a movable pivot, and free flight like a spaceship

## Why

Looking closely at a model doesn't work today. The orbit camera always turns and zooms around the
centre of what it frames, so the tip of Voyager's magnetometer boom can't be brought up close. In
lessons, the view may only turn 30° either way. Free flight has many keys: WASD, arrows, R/F, Q/E
and Shift. The only hint is one line of text, so nobody finds R/F. The controls should feel like
those of the 3D apps people know (Sketchfab, Google Earth, Blender's "zoom to mouse"), and work
without reading anything first.

## Goals

- Move the point the camera turns and zooms around: a pan, the way other 3D apps do it.
- Zoom toward what is under the pointer, not toward the middle.
- In lessons: look all around a model; Reset still brings the chapter's view back.
- Free flight flown like a spaceship: steer the nose, thrust forward and back with weight.
- Show the controls as a graphic overlay of keys and gestures, not a line of text.

## Non-goals

- Picking a point on a model by double click to make it the pivot. It may come later and is not
  part of this work. A double click on a body keeps flying there, as now.
- Changes to the tours, which lock the camera as before.
- Gamepad support.

## Anti-goals

- A mouse wheel that pans when the user wanted to zoom. If the trackpad guess is unsure, it
  zooms.
- Getting lost in empty space: the pivot can't wander far from the scene.
- A ship that only drifts on and doesn't come back to rest by itself.

## Approaches (for the orbit gestures)

Two-finger scroll on a trackpad and a mouse wheel reach the browser as the same wheel event. Only
pinch is clearly marked (`ctrlKey`).

- **A – like Sketchfab and Google Earth (chosen):** drag turns, pinch zooms, two-finger scroll
  pans. A mouse wheel, told apart from a trackpad by its coarse steps, zooms. Right-drag and
  Shift-drag pan with a mouse. This feels most natural on a trackpad. The cost is the guess
  between mouse wheel and trackpad.
- **B – classic, like Blender and Celestia:** scroll always zooms, toward the pointer, so the
  pivot moves along as you zoom in. Pan by right-drag or Shift-drag. Nothing is guessed, but a
  trackpad can't pan with two fingers.
- **C – B plus double click:** double-click a point on the model to make it the pivot. Very
  direct, but needs a point on the mesh (depth or ray picking), and clashes with double click
  flying to a body in Explore.

The user chose **A, with zoom toward the pointer** taken from B.

## Part 1 – Orbit: a movable pivot (Explore and lessons)

### Gestures

| Device   | Turn                 | Zoom (toward the pointer)                   | Pan (moves the pivot)          |
|----------|----------------------|---------------------------------------------|--------------------------------|
| Trackpad | drag                 | pinch                                       | two-finger scroll              |
| Mouse    | drag                 | wheel                                       | right-drag or Shift-drag       |
| Touch    | one finger           | pinch (toward the midpoint of the fingers)  | two fingers moving together    |
| Keyboard | arrows               | W / S (in / out), also + / −                | –                              |

After a pan or a zoom, everything turns and zooms around the new pivot.

### Behaviour

- **Zoom toward the pointer.** The point under the pointer, on the plane through the pivot facing
  the camera, stays under the pointer while zooming. So the pivot moves toward it as you zoom in.
  Zooming out moves it back the same way.
- **Telling the mouse wheel from the trackpad.** It is a trackpad if the wheel event has
  fractional deltas, a `deltaX`, or small deltas in quick succession. It is a mouse wheel if
  `deltaMode` is lines, or the steps are coarse and even (e.g. multiples of about 100). Pinch
  (`ctrlKey`) always zooms. The builder settles the exact rule; the anti-goal decides doubtful
  cases.
- **Pan limit.** The pivot stays within the scene's size around where the shot put it: the
  framing bounds in a lesson, about the followed body's size (or its orbit radius) in Explore.
  Beyond that it stops softly.
- **Lessons.**
  - Model scenes (the Voyager probe whole and taken apart, the Golden Record) may be turned all
    the way around, and seen from straight above and below. The 30° limit goes. The camera keeps
    its "up", so it does not tumble over the top. They may also be zoomed in down to the scene's
    own zoom floor, not only to 30% of the framing.
  - All other lessons get a looser limit (about 90° instead of 30°). Their staged scenes are made
    for a viewing direction; the builder checks each one.
  - Ground shots stay fixed, as now.
  - A new chapter, and the Reset button (kept), bring back the chapter's framing and pivot.
- **Explore.** The pan is kept as an offset from the followed body, so the pivot moves along with
  it. A double click on a body flies there and puts the pivot back in its middle. Choosing
  another body clears the offset.
- **Keyboard in orbit.** R/F are dropped. W/S zoom, matching W as "forward" in flight.

## Part 2 – Free flight like a spaceship

### Controls

| Input              | Effect                                                                                |
|--------------------|---------------------------------------------------------------------------------------|
| ↑ / ↓              | pitch: nose down / up (about the ship's x-axis)                                       |
| ← / →              | yaw: nose left / right (about the ship's y-axis), no strafing                         |
| Q / E              | roll left / right about the line of sight (z-axis)                                    |
| W                  | forward thrust: full thrust while held, building up with weight                       |
| S                  | backward thrust, the same                                                             |
| nothing held       | the ship slows down with weight until it stands still                                 |
| Shift              | boost (as now)                                                                        |
| drag (mouse/touch) | pitch and yaw, like the arrows                                                        |
| wheel / pinch      | top speed level (as now)                                                              |
| Touch              | the stick pitches and yaws; buttons for forward and back thrust, roll, boost         |

A/D (strafe) and R/F (up and down) are dropped.

### Feel (the builder's call, to be tuned by eye)

- **Thrust with weight.** Today the ship eases to its velocity in 0.35 s. Make it about 1.5 s to
  reach top speed and about 2 s to stop, so that it feels like mass. The keep-outside rules for
  bodies and the speed levels stay as they are.
- **Turning.** Arrows turn at a rate that eases in and out (about 0.2 s), so a tap gives a small
  correction and holding gives a steady turn.
- **Levelling.** The existing slow levelling to the ecliptic stays, but pauses while Q/E are held
  and for a moment after.

## Part 3 – The controls overlay

- **A graphic, not text.** The overlay draws the keys as keycaps, laid out like a keyboard, with
  short labels:
  - Free flight: Q W E / S, the arrow cluster, Shift.
  - Orbit: gesture icons for drag, two fingers, pinch and wheel, plus the arrows and W/S.
- **On a touch device** it shows only the gestures, or the on-screen pad's buttons.
- **When it appears:**
  - on switching into each camera mode;
  - the first time a lesson opens, with the orbit gestures;
  - after a few seconds (about 6) it fades.
- **Live keys.** While it is shown, a pressed key lights up on it.
- **Help.** `?` (and a help entry in the camera panel) brings it back at any time; Escape or a
  click closes it.
- **Style.** It follows the HUD's glass/dichroic style, not Rams. It replaces the text hints in
  `src/hud/cameraHint.ts`; the speed readout there stays. Texts go in en and de.

## Constraints

- Browser only, WebGPU app. No new dependencies.
- Every control has a keyboard or pointer path; the overlay is reachable by keyboard and labelled
  for screen readers.
- `prefers-reduced-motion`: no fade animations, and the zoom eases are shortened.
- Existing e2e tests that use WASD, R/F or the orbit limits change with this. Local headless
  WebGPU is unreliable, so unit tests carry the input logic: wheel classification, zoom toward
  the pointer, pan limits, flight command mapping.

## Order of work

1. Part 1 (orbit: pivot, zoom toward the pointer, lesson limits).
2. Part 2 (spaceship flight).
3. Part 3 (overlay), which shows the controls of 1 and 2.

Each part ships on its own; the old text hint stays until Part 3 replaces it.

## Left to the builder

- The exact wheel classification rule, and the numbers for the pan limit, the turn rates and the
  thrust times.
- Which non-model lessons can take the looser limit without showing the edges of their staged
  scenes.
- The overlay's keycap artwork, within the HUD style.
