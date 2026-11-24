import { STATION_SHOTS, type PlannedShot } from './stationShots'

// Which shot runs: a moment pinned to the mission time wins; otherwise the station's shots in turn,
// each for its seconds, round again if the station runs longer - the same at the same place every
// time, so scrubbing back shows what was there.

export interface Running {
  shot: PlannedShot
  // A key for the shot (a change is a cut).
  key: string
  // Seconds into it.
  seconds: number
}

export function shotAt(stationId: string, stationSeconds: number, get: number): Running {
  const plan = STATION_SHOTS[stationId]
  const pinned = plan.pinned?.findIndex((p) => get >= p.from && get < p.to) ?? -1
  if (pinned >= 0) {
    const p = plan.pinned![pinned]
    return { shot: p, key: `${stationId}:pin${pinned}`, seconds: get - p.from }
  }
  const round = plan.shots.reduce((sum, s) => sum + s.seconds, 0)
  let t = stationSeconds % round
  const lap = Math.floor(stationSeconds / round)
  for (const [index, shot] of plan.shots.entries()) {
    if (t < shot.seconds) return { shot, key: `${stationId}:${lap}:${index}`, seconds: t }
    t -= shot.seconds
  }
  const last = plan.shots.length - 1
  return { shot: plan.shots[last], key: `${stationId}:${lap}:${last}`, seconds: 0 }
}
