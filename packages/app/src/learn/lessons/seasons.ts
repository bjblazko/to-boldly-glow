import type { Chapter, Lesson } from '../lessonTypes'

const CHAPTERS: Chapter[] = [
  {
    id: 'orbit',
    title: 'Real Orbit: Earth Around the Sun',
    kind: 'orbit',
    // Unused by this chapter - unlike every other chapter, this one's Earth position isn't a fixed
    // per-chapter phase at all. It continuously animates instead (see main.ts's
    // orbitRevolutionDegrees), so there's no single "this chapter's phase" to record here. Kept at
    // 0 only because every Chapter needs a value for this field.
    seasonPhaseDegrees: 0,
    text:
      "Watch Earth actually orbit the Sun. Its axis always points the same fixed direction in " +
      "space - it never tips toward the Sun and never straightens up to face it. But because " +
      "Earth's position keeps changing, the angle between that fixed axis and the Sun keeps " +
      'changing too: sometimes leaning toward the Sun, sometimes away from it, and twice a lap ' +
      "exactly side-on. That changing angle - not the axis itself moving - is the real reason " +
      "Earth has seasons. (Earth briefly passes behind the Sun from this camera's angle once per " +
      "lap - that's just this viewpoint, not anything unusual happening in space.)",
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
