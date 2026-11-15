import type { ChapterChart, ChapterFact, ChapterPhoto } from '../learn/lessonTypes'
import type { VoyagerProbeId } from '../learn/voyager/voyagerStage'

// Where the camera is while a station's card is open: following the probe, over the planets,
// looking back from Voyager 1 at the Pale Blue Dot, or out at the heliopause.
export type MissionView = 'follow' | 'overview' | 'paleBlueDot' | 'heliosphere'

// One station of a mission tour: a moment of the flight with its card. A station with an encounter
// is a planet flyby, shown at true scale (data/voyager/encounters/<probe>-<planet>.bin).
export interface Station {
  // Its words: msg.missions[probe].stations[id].
  id: string
  date: string
  view: MissionView
  encounter?: 'jupiter' | 'saturn' | 'uranus' | 'neptune'
  // The probes on the route at this station (the tour's own if not given) - e.g. both, where one
  // overtakes the other.
  probes?: VoyagerProbeId[]
  photo?: ChapterPhoto
  chart?: ChapterChart
  facts?: ChapterFact[]
}

export interface Mission {
  probe: VoyagerProbeId
  stations: Station[]
}

const MS_PER_DAY = 86400000
const J2000_MS = Date.UTC(2000, 0, 1, 12)

// Days since J2000 (noon, 1 January 2000) of an ISO date.
export function stationDay(station: Station): number {
  return (Date.parse(station.date) - J2000_MS) / MS_PER_DAY
}

// The id of a station's clip: narration/<voice>/<locale>/tours/<probe>/<station>.webm.
export function missionClipId(probe: string, stationId: string): string {
  return `tours/${probe}/${stationId}`
}
