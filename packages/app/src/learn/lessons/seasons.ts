import { ECLIPTIC_NORTH } from '../../solarSystem/poleOrientation'
import type { Chapter, LatitudePreset, Lesson } from '../lessonTypes'

// Approximate 2026 UTC equinox/solstice dates - real astronomical events, not tied to any
// particular precision requirement (this is a pedagogical animation, not an ephemeris tool; the
// solar-system-wide VSOP87 position math elsewhere in this app already handles precision where it
// matters). Each non-intro chapter's dateRange spans two weeks centered on its defining date, so
// scrubbing shows the axial-tilt effect ramping in/out rather than a single frozen instant.
const MARCH_EQUINOX_2026 = new Date('2026-03-20T00:00:00Z')
const JUNE_SOLSTICE_2026 = new Date('2026-06-21T00:00:00Z')
const SEPTEMBER_EQUINOX_2026 = new Date('2026-09-23T00:00:00Z')
const DECEMBER_SOLSTICE_2026 = new Date('2026-12-21T00:00:00Z')

function weekWindow(centerDate: Date): [Date, Date] {
  const weekMs = 7 * 24 * 60 * 60 * 1000
  return [new Date(centerDate.getTime() - weekMs), new Date(centerDate.getTime() + weekMs)]
}

export const LATITUDE_PRESETS: LatitudePreset[] = [
  { id: 'equator', label: 'Equator', latitudeDegrees: 0 },
  {
    id: 'tropic-of-cancer',
    label: 'Tropic of Cancer',
    latitudeDegrees: 23.4,
    text: () =>
      'At the Tropic of Cancer, the June solstice sun passes directly overhead at noon - the most ' +
      'direct sunlight of the year here. At the December solstice, the sun is at its lowest and ' +
      'least direct.',
  },
  {
    id: 'tropic-of-capricorn',
    label: 'Tropic of Capricorn',
    latitudeDegrees: -23.4,
    text: () =>
      'At the Tropic of Capricorn, the December solstice sun passes directly overhead at noon - ' +
      'the most direct sunlight of the year here. At the June solstice, the sun is at its lowest ' +
      'and least direct.',
  },
  {
    id: 'arctic-circle',
    label: 'Arctic Circle',
    latitudeDegrees: 66.6,
    text: () => 'At the Arctic Circle, the sun never fully sets around the June solstice, and never fully rises around the December solstice.',
  },
  {
    id: 'antarctic-circle',
    label: 'Antarctic Circle',
    latitudeDegrees: -66.6,
    text: () => 'At the Antarctic Circle, the pattern is reversed from the Arctic - the sun never sets around the December solstice.',
  },
  { id: 'reykjavik', label: 'Reykjavik', latitudeDegrees: 64.1 },
  { id: 'singapore', label: 'Singapore', latitudeDegrees: 1.35 },
]

const introFraming = { date: MARCH_EQUINOX_2026, radiusMultiplier: 14, azimuth: Math.PI / 4, elevation: 0.35, upAxis: ECLIPTIC_NORTH }
const marchFraming = { date: MARCH_EQUINOX_2026, radiusMultiplier: 8, azimuth: 0, elevation: 0.4, upAxis: ECLIPTIC_NORTH }
const juneFraming = { date: JUNE_SOLSTICE_2026, radiusMultiplier: 8, azimuth: Math.PI / 2, elevation: 0.4, upAxis: ECLIPTIC_NORTH }
const septemberFraming = { date: SEPTEMBER_EQUINOX_2026, radiusMultiplier: 8, azimuth: Math.PI, elevation: 0.4, upAxis: ECLIPTIC_NORTH }
const decemberFraming = { date: DECEMBER_SOLSTICE_2026, radiusMultiplier: 8, azimuth: (3 * Math.PI) / 2, elevation: 0.4, upAxis: ECLIPTIC_NORTH }

const CHAPTERS: Chapter[] = [
  {
    id: 'intro',
    title: 'Intro: A Tilted World',
    dateRange: weekWindow(MARCH_EQUINOX_2026),
    cameraFraming: introFraming,
    text: () =>
      "Earth's axis is tilted 23.4° relative to its orbit around the Sun. This tilt - not " +
      "Earth's distance from the Sun, which barely changes over a year - is what causes the " +
      'seasons. Step through the chapters below to see why.',
  },
  {
    id: 'march-equinox',
    title: 'March Equinox',
    dateRange: weekWindow(MARCH_EQUINOX_2026),
    cameraFraming: marchFraming,
    text: (scrubT, latitude) =>
      latitude.text?.(scrubT) ??
      `Around the March equinox, the Sun sits directly over the equator. At ${latitude.label}, ` +
        'day and night are close to equal length.',
  },
  {
    id: 'june-solstice',
    title: 'June Solstice',
    dateRange: weekWindow(JUNE_SOLSTICE_2026),
    cameraFraming: juneFraming,
    text: (scrubT, latitude) =>
      latitude.text?.(scrubT) ??
      `The June solstice: the north pole tilts toward the Sun. At ${latitude.label}, this means ` +
        (latitude.latitudeDegrees >= 0
          ? 'longer days and more direct sunlight - summer.'
          : 'shorter days and more oblique sunlight - winter.'),
  },
  {
    id: 'september-equinox',
    title: 'September Equinox',
    dateRange: weekWindow(SEPTEMBER_EQUINOX_2026),
    cameraFraming: septemberFraming,
    text: (scrubT, latitude) =>
      latitude.text?.(scrubT) ??
      `Around the September equinox, the Sun is back over the equator. At ${latitude.label}, day ` +
        'and night are close to equal again - the reverse trend from March.',
  },
  {
    id: 'december-solstice',
    title: 'December Solstice',
    dateRange: weekWindow(DECEMBER_SOLSTICE_2026),
    cameraFraming: decemberFraming,
    text: (scrubT, latitude) =>
      latitude.text?.(scrubT) ??
      `The December solstice: the south pole tilts toward the Sun. At ${latitude.label}, this ` +
        'means ' +
        (latitude.latitudeDegrees >= 0
          ? 'shorter days and more oblique sunlight - winter.'
          : 'longer days and more direct sunlight - summer.'),
  },
]

export const SEASONS_LESSON: Lesson = {
  id: 'seasons',
  title: 'Why does Earth have seasons?',
  chapters: CHAPTERS,
  latitudePresets: LATITUDE_PRESETS,
}

export const LESSONS_BY_ID: Record<string, Lesson> = {
  [SEASONS_LESSON.id]: SEASONS_LESSON,
}
