import { msg } from '../../i18n/i18n'
import type { Chapter, Lesson } from '../lessonTypes'

const TEXT = msg.lessons.seasons

const CHAPTERS: Chapter[] = [
  {
    id: 'orbit',
    ...TEXT.chapters.orbit,
    kind: 'orbit',
    // Unused by this chapter - unlike every other chapter, this one's Earth position isn't a fixed
    // per-chapter phase at all. It continuously animates instead (see seasons/seasonsScene.ts's
    // orbitRevolutionDegrees), so there's no single "this chapter's phase" to record here. Kept at
    // 0 only because every Chapter needs a value for this field.
    seasonPhaseDegrees: 0,
  },
  {
    id: 'intro',
    ...TEXT.chapters.intro,
    // Shows the full 23.4-degree lean (same phase as june-solstice) so the picture backs up this
    // chapter's own opening sentence - an equinox-like 0-degree phase here would show a perfectly
    // upright axis while the text claims a visible 23.4-degree tilt, directly contradicting it.
    kind: 'staged',
    seasonPhaseDegrees: 0,
  },
  {
    id: 'march-equinox',
    ...TEXT.chapters['march-equinox'],
    kind: 'staged',
    seasonPhaseDegrees: 270,
  },
  {
    id: 'june-solstice',
    ...TEXT.chapters['june-solstice'],
    kind: 'staged',
    seasonPhaseDegrees: 0,
  },
  {
    id: 'september-equinox',
    ...TEXT.chapters['september-equinox'],
    kind: 'staged',
    seasonPhaseDegrees: 90,
  },
  {
    id: 'december-solstice',
    ...TEXT.chapters['december-solstice'],
    kind: 'staged',
    seasonPhaseDegrees: 180,
  },
]

export const SEASONS_LESSON: Lesson = {
  id: 'seasons',
  title: TEXT.title,
  chapters: CHAPTERS,
  markerLatitudeDegrees: 45,
  note: TEXT.note,
}
