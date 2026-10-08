import type { Lesson } from '../lessonTypes'
import { MOON_PHASES_LESSON } from './moonPhases'
import { PLANET_SIZES_LESSON } from './planetSizes'
import { SEASONS_LESSON } from './seasons'
import { SOLAR_ECLIPSE_LESSON } from './solarEclipse'

// Every lesson, by the id its entry in the lesson picker (index.html) names.
export const LESSONS_BY_ID: Record<string, Lesson> = {
  [SEASONS_LESSON.id]: SEASONS_LESSON,
  [PLANET_SIZES_LESSON.id]: PLANET_SIZES_LESSON,
  [SOLAR_ECLIPSE_LESSON.id]: SOLAR_ECLIPSE_LESSON,
  [MOON_PHASES_LESSON.id]: MOON_PHASES_LESSON,
}
