// Apollo 11's events in mission time (ground elapsed time, GET, from range zero), to the
// hundredth of a second where the record has it. Source: "Apollo by the Numbers", NASA SP-4029
// (Orloff, 2000), the Apollo 11 timeline and trajectory tables (archive.org item
// apollo-by-the-numbers). Their names and texts come with the lessons that show them.

export interface MissionEvent {
  id: string
  // Seconds after range zero.
  get: number
}

// Range zero: 13:32:00 UTC on 16 July 1969 (the landing, at 102:45:39.9 GET, was 20:17:39.9 UTC).
export const APOLLO11_RANGE_ZERO_UTC = Date.UTC(1969, 6, 16, 13, 32, 0)

// "hhh:mm:ss.ss" to seconds.
export function getSeconds(time: string): number {
  const [hours, minutes, seconds] = time.split(':').map(Number)
  return hours * 3600 + minutes * 60 + seconds
}

// When an event happened, in UTC milliseconds.
export function eventUtc(event: MissionEvent): number {
  return APOLLO11_RANGE_ZERO_UTC + event.get * 1000
}

const EVENTS: [string, string][] = [
  ['rangeZero', '000:00:00.00'],
  ['liftoff', '000:00:00.63'],
  ['maxQ', '000:01:23.00'],
  ['sicCutoff', '000:02:41.63'],
  ['siiCutoff', '000:09:08.22'],
  ['sivbFirstCutoff', '000:11:39.33'],
  ['earthOrbitInsertion', '000:11:49.33'],
  ['tliIgnition', '002:44:16.20'],
  ['tliCutoff', '002:50:03.03'],
  ['translunarInjection', '002:50:13.03'],
  ['csmSeparation', '003:15:23.00'],
  ['docking', '003:24:03.70'],
  ['ejection', '004:17:03.00'],
  ['evasiveManeuver', '004:40:01.72'],
  ['midcourseCorrection', '026:44:58.64'],
  ['loiIgnition', '075:49:50.37'],
  ['loiCutoff', '075:55:47.90'],
  ['circularization', '080:11:36.75'],
  ['undocking', '100:12:00.00'],
  ['separation', '100:39:52.90'],
  ['descentOrbitInsertion', '101:36:14.00'],
  ['poweredDescent', '102:33:05.01'],
  ['landing', '102:45:39.90'],
  ['firstStep', '109:24:15.00'],
  ['hatchClosed', '111:39:13.00'],
  ['lunarLiftoff', '124:22:00.79'],
  ['rendezvousDocking', '128:03:00.00'],
  ['ascentStageJettison', '130:09:31.20'],
  ['teiIgnition', '135:23:42.28'],
  ['teiCutoff', '135:26:13.69'],
  ['transearthMidcourse', '150:29:57.40'],
  ['cmSmSeparation', '194:49:12.70'],
  ['entryInterface', '195:03:05.70'],
  ['splashdown', '195:18:35.00'],
]

export const APOLLO11_EVENTS: readonly MissionEvent[] = EVENTS.map(([id, time]) => ({ id, get: getSeconds(time) }))
