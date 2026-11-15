import { msg } from '../i18n/i18n'
import type { StationText } from '../i18n/messages/en/missions'
import { voyagerPhoto } from '../learn/lessons/voyager'
import type { VoyagerProbeId } from '../learn/voyager/voyagerStage'
import type { Mission, Station } from './missionTimeline'

type StationTexts = Record<string, StationText>

// A station with its photo's caption and its facts from the catalog (the facts share one icon).
function station(texts: StationTexts, fields: Omit<Station, 'photo' | 'facts'> & { photo?: string; credit?: string }): Station {
  const text = texts[fields.id]
  const { photo, credit, ...rest } = fields
  return {
    ...rest,
    photo: photo && text.caption ? voyagerPhoto(photo, text.caption, credit) : undefined,
    facts: text.facts?.map((fact) => ({ icon: 'sun-distance' as const, ...fact })),
  }
}

const V1 = msg.missions.voyager1.stations
const V2 = msg.missions.voyager2.stations

export const VOYAGER_MISSIONS: Record<VoyagerProbeId, Mission> = {
  voyager1: {
    probe: 'voyager1',
    stations: [
      station(V1, { id: 'launch', date: '1977-09-05T12:56:00Z', view: 'overview', photo: 'PIA21747', credit: 'NASA/JPL-Caltech/KSC' }),
      { ...station(V1, { id: 'overtake', date: '1977-12-15T00:00:00Z', view: 'follow' }), probes: ['voyager1', 'voyager2'] },
      station(V1, { id: 'jupiter', date: '1979-03-05T12:05:00Z', view: 'follow', encounter: 'jupiter', photo: 'PIA00379' }),
      station(V1, { id: 'saturn', date: '1980-11-12T23:46:00Z', view: 'follow', encounter: 'saturn', photo: 'PIA00024' }),
      // The camera is Voyager 1, looking back: it shows neither itself nor its own path.
      { ...station(V1, { id: 'pale-blue-dot', date: '1990-02-14T00:00:00Z', view: 'paleBlueDot', photo: 'PIA23645', credit: 'NASA/JPL-Caltech' }), probes: [] },
      station(V1, { id: 'termination-shock', date: '2004-12-16T00:00:00Z', view: 'heliosphere' }),
      { ...station(V1, { id: 'heliopause', date: '2012-08-25T00:00:00Z', view: 'heliosphere' }), chart: 'heliopauseVoyager1' },
      station(V1, { id: 'today', date: '2026-11-15T00:00:00Z', view: 'heliosphere' }),
    ],
  },
  voyager2: {
    probe: 'voyager2',
    stations: [
      station(V2, { id: 'launch', date: '1977-08-20T14:29:00Z', view: 'overview', photo: 'PIA21744', credit: 'NASA/JPL-Caltech' }),
      station(V2, { id: 'jupiter', date: '1979-07-09T22:29:00Z', view: 'follow', encounter: 'jupiter', photo: 'PIA00459' }),
      station(V2, { id: 'saturn', date: '1981-08-26T03:24:00Z', view: 'follow', encounter: 'saturn', photo: 'PIA01486' }),
      station(V2, { id: 'uranus', date: '1986-01-24T17:59:00Z', view: 'follow', encounter: 'uranus', photo: 'PIA00042' }),
      station(V2, { id: 'neptune', date: '1989-08-25T03:56:00Z', view: 'follow', encounter: 'neptune', photo: 'PIA02246' }),
      station(V2, { id: 'termination-shock', date: '2007-08-30T00:00:00Z', view: 'heliosphere' }),
      { ...station(V2, { id: 'heliopause', date: '2018-11-05T00:00:00Z', view: 'heliosphere' }), chart: 'heliopauseVoyager2' },
      station(V2, { id: 'today', date: '2026-11-15T00:00:00Z', view: 'heliosphere' }),
    ],
  },
}

// The moon each flyby shows (its path is in the flyby's data file).
export const FLYBY_MOONS: Record<string, string> = {
  'voyager1-jupiter': 'io',
  'voyager1-saturn': 'titan',
  'voyager2-jupiter': 'europa',
  'voyager2-saturn': 'titan',
  'voyager2-uranus': 'titania',
  'voyager2-neptune': 'triton',
}
