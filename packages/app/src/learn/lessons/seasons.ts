import type { Chapter, Lesson } from '../lessonTypes'

const CHAPTERS: Chapter[] = [
  {
    id: 'orbit-march',
    title: 'Real March Equinox',
    kind: 'orbit',
    seasonPhaseDegrees: 270,
    text:
      "This is Earth's real position in its orbit around the Sun in March. Its axis points the " +
      'same fixed direction in space it always does - what changes as Earth orbits is not the ' +
      'axis, but where Earth is relative to the Sun.',
  },
  {
    id: 'orbit-june',
    title: 'Real June Solstice',
    kind: 'orbit',
    seasonPhaseDegrees: 0,
    text:
      "Three months later, Earth has moved to this point in its orbit. Its axis hasn't moved at " +
      "all - it points the exact same fixed direction as before. But because Earth is now here, " +
      'that same axis leans 23.4° toward the Sun.',
  },
  {
    id: 'orbit-september',
    title: 'Real September Equinox',
    kind: 'orbit',
    seasonPhaseDegrees: 90,
    text:
      "Another three months on, and Earth's axis still hasn't moved - same fixed direction as " +
      'every chapter so far. From here, though, it leans neither toward nor away from the Sun.',
  },
  {
    id: 'orbit-december',
    title: 'Real December Solstice',
    kind: 'orbit',
    seasonPhaseDegrees: 180,
    text:
      'Half a year after June, Earth has orbited around to the opposite side of the Sun. The ' +
      "axis is still pointing the same fixed direction it always has - now that puts it 23.4° " +
      'away from the Sun instead of toward it. Watch how the next chapters show the same idea a ' +
      'different way.',
  },
  {
    id: 'intro',
    title: 'Intro: A Tilted World',
    // Shows the full 23.4-degree lean (same phase as june-solstice) so the picture backs up this
    // chapter's own opening sentence - an equinox-like 0-degree phase here would show a perfectly
    // upright axis while the text claims a visible 23.4-degree tilt, directly contradicting it.
    kind: 'staged',
    seasonPhaseDegrees: 0,
    text:
      "Earth's axis is tilted 23.4° relative to its orbit around the Sun. This tilt - not Earth's " +
      'distance from the Sun, which barely changes over a year - is what causes the seasons. Watch ' +
      'Location A (north) and Location B (south) as you step through the chapters below.',
  },
  {
    id: 'march-equinox',
    title: 'March Equinox',
    kind: 'staged',
    seasonPhaseDegrees: 270,
    text:
      "Around the March equinox, the Sun sits directly over Earth's equator. Location A and " +
      'Location B get close to equal day and night length.',
  },
  {
    id: 'june-solstice',
    title: 'June Solstice',
    kind: 'staged',
    seasonPhaseDegrees: 0,
    text:
      'The June solstice: the north pole tilts toward the Sun. Location A (north) gets longer days ' +
      'and more direct sunlight - summer. Location B (south) gets shorter days and more oblique ' +
      'sunlight - winter.',
  },
  {
    id: 'september-equinox',
    title: 'September Equinox',
    kind: 'staged',
    seasonPhaseDegrees: 90,
    text:
      'Around the September equinox, the Sun is back over the equator. Location A and Location B ' +
      'get close to equal day and night again - the reverse trend from March.',
  },
  {
    id: 'december-solstice',
    title: 'December Solstice',
    kind: 'staged',
    seasonPhaseDegrees: 180,
    text:
      'The December solstice: the south pole tilts toward the Sun. Location B (south) gets longer ' +
      'days and more direct sunlight - summer. Location A (north) gets shorter days and more ' +
      'oblique sunlight - winter.',
  },
]

export const SEASONS_LESSON: Lesson = {
  id: 'seasons',
  title: 'Why does Earth have seasons?',
  chapters: CHAPTERS,
  markerLatitudeDegrees: 45,
}

export const LESSONS_BY_ID: Record<string, Lesson> = {
  [SEASONS_LESSON.id]: SEASONS_LESSON,
}
