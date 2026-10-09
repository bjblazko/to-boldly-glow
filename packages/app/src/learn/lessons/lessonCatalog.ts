import type { Lesson } from '../lessonTypes'
import { MOON_PHASES_LESSON } from './moonPhases'
import { PLANET_SIZES_LESSON } from './planetSizes'
import { SEASONS_LESSON } from './seasons'
import { SOLAR_ECLIPSE_LESSON } from './solarEclipse'

// A shelf of the lesson library. A new lesson goes onto the topic it belongs to (or a new topic):
// the library lists it from here.
export interface LessonTopic {
  title: string
  lessons: Lesson[]
}

export const LESSON_TOPICS: LessonTopic[] = [
  { title: 'Planets & scale', lessons: [PLANET_SIZES_LESSON] },
  { title: 'Earth & Moon', lessons: [SEASONS_LESSON, MOON_PHASES_LESSON] },
  { title: 'Sky events', lessons: [SOLAR_ECLIPSE_LESSON] },
]

// Every lesson, by its id (the library's cards name them by it).
export const LESSONS_BY_ID: Record<string, Lesson> = Object.fromEntries(
  LESSON_TOPICS.flatMap((topic) => topic.lessons).map((lesson) => [lesson.id, lesson]),
)
