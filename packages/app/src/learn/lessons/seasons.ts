import type { Chapter, Lesson } from '../lessonTypes'

const CHAPTERS: Chapter[] = [
  {
    id: 'intro',
    title: 'Intro: A Tilted World',
    seasonPhaseDegrees: 90, // neutral/equinox-like, per the design spec's Intro treatment
    text:
      "Earth's axis is tilted 23.4° relative to its orbit around the Sun. This tilt - not Earth's " +
      'distance from the Sun, which barely changes over a year - is what causes the seasons. Watch ' +
      'Location A (north) and Location B (south) as you step through the chapters below.',
  },
  {
    id: 'march-equinox',
    title: 'March Equinox',
    seasonPhaseDegrees: 270,
    text:
      "Around the March equinox, the Sun sits directly over Earth's equator. Location A and " +
      'Location B get close to equal day and night length.',
  },
  {
    id: 'june-solstice',
    title: 'June Solstice',
    seasonPhaseDegrees: 0,
    text:
      'The June solstice: the north pole tilts toward the Sun. Location A (north) gets longer days ' +
      'and more direct sunlight - summer. Location B (south) gets shorter days and more oblique ' +
      'sunlight - winter.',
  },
  {
    id: 'september-equinox',
    title: 'September Equinox',
    seasonPhaseDegrees: 90,
    text:
      'Around the September equinox, the Sun is back over the equator. Location A and Location B ' +
      'get close to equal day and night again - the reverse trend from March.',
  },
  {
    id: 'december-solstice',
    title: 'December Solstice',
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
