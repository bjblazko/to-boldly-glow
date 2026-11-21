import type { Lesson } from '../lessonTypes'
import { MOON_PHASES_LESSON } from './moonPhases'
import { PLANET_SIZES_LESSON } from './planetSizes'
import { COLUMBIA_LESSON } from './columbia'
import { EAGLE_LESSON } from './eagle'
import { LAUNCHER_LESSON } from './launcher'
import { SATURN_V_LESSON } from './saturnV'
import { SEASONS_LESSON } from './seasons'
import { SOLAR_ECLIPSE_LESSON } from './solarEclipse'
import { VOYAGER_LESSON } from './voyager'
import { VOYAGER_DEEP_DIVE_LESSON } from './voyagerDeepDive'
import { msg } from '../../i18n/i18n'

// A shelf of the lesson library. A new lesson goes onto the topic it belongs to (or a new topic):
// the library lists it from here.
export interface LessonTopic {
  title: string
  lessons: Lesson[]
}

export const LESSON_TOPICS: LessonTopic[] = [
  { title: msg.lessons.topics.planets, lessons: [PLANET_SIZES_LESSON] },
  { title: msg.lessons.topics.earthAndMoon, lessons: [SEASONS_LESSON, MOON_PHASES_LESSON] },
  { title: msg.lessons.topics.skyEvents, lessons: [SOLAR_ECLIPSE_LESSON] },
  { title: msg.lessons.topics.missions, lessons: [VOYAGER_LESSON, VOYAGER_DEEP_DIVE_LESSON, SATURN_V_LESSON, COLUMBIA_LESSON, EAGLE_LESSON, LAUNCHER_LESSON] },
]

// Every lesson, by its id (the library's cards name them by it).
export const LESSONS_BY_ID: Record<string, Lesson> = Object.fromEntries(
  LESSON_TOPICS.flatMap((topic) => topic.lessons).map((lesson) => [lesson.id, lesson]),
)
