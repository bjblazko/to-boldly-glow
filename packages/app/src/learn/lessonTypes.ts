// A chapter of a lesson. `seasonPhaseDegrees` is this chapter's fixed position in an idealized
// annual cycle (0 = June solstice, 90 = September equinox, 180 = December solstice, 270 = March
// equinox - see main.ts's seasonalPoleDirection for how this becomes an actual tilt orientation).
// There is no calendar date or scrub position in this design - the lesson stages a fixed diagram
// where only Earth's tilt orientation changes between chapters, not its position or a real date.
export interface Chapter {
  id: string
  title: string
  seasonPhaseDegrees: number
  text: string
}

export interface Lesson {
  id: string
  title: string
  chapters: Chapter[]
  // Latitude magnitude (degrees) for the two symmetric, always-visible location markers - one at
  // +markerLatitudeDegrees, one at -markerLatitudeDegrees. A single number, not a pair, since the
  // whole point is that they're mirror images of each other (same distance from the poles and from
  // the equator).
  markerLatitudeDegrees: number
}
