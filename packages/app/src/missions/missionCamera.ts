import { vec3 } from 'gl-matrix'
import { orbitBasisForUpAxis, type OrbitCamera } from '../camera/orbitCamera'
import { PALE_BLUE_DOT } from '../learn/voyager/voyagerShots'
import type { Vec3 } from '../math/tuples'
import { ECLIPTIC_NORTH } from '../solarSystem/poleOrientation'
import type { EncounterCamera } from './encounterScene'
import type { MissionView } from './missionTimeline'

// Where the camera wants to be: the orbit camera's target, distance and angles.
export interface CameraGoal {
  target: Vec3
  radius: number
  azimuth: number
  elevation: number
  upAxis: Vec3
}

const ECLIPTIC_UP: Vec3 = [...ECLIPTIC_NORTH]
// How quickly the camera catches up with its goal (per second): smooth, but never lagging far.
const FOLLOW_RATE = 1.2
// Following the probe toward a planet: both in the picture, from behind and above the probe.
const FOLLOW = { share: 0.4, margin: 30, minRadius: 45, maxRadius: 560, behind: 2.2, elevation: 0.6 }
const OVERVIEWS: Partial<Record<MissionView, { radius: number; elevation: number }>> = {
  overview: { radius: 330, elevation: 1.0 },
}
// Out at the edge of the Sun's bubble the distances barely change at Compact scale: the camera stays
// near the probe and circles it slowly, so it is seen flying through the boundaries.
const HELIOSPHERE = { share: 0.85, radius: 170, elevation: 0.35, behind: 1.6, turnRadiansPerSecond: 0.05 }

// The flight's camera goal: over the planets, circling the probe at the heliosphere's edge (by
// `seconds` of tour time), looking back from Voyager 1 on 14 February 1990, or following the probe
// toward the next planet.
export function flightGoal(view: MissionView, probe: Vec3, { nextPlanet, seconds }: { nextPlanet: Vec3 | null; seconds: number }): CameraGoal {
  const overview = OVERVIEWS[view]
  if (overview) return { target: [0, 0, 0], radius: overview.radius, azimuth: -Math.PI / 2, elevation: overview.elevation, upAxis: ECLIPTIC_UP }
  if (view === 'paleBlueDot') return { target: [0, 0, 0], ...PALE_BLUE_DOT, upAxis: ECLIPTIC_UP }
  if (view === 'heliosphere') return heliosphereGoal(probe, seconds)
  const toward = nextPlanet ?? probe
  const target = probe.map((value, axis) => value + (toward[axis] - value) * FOLLOW.share) as Vec3
  const apart = vec3.distance(probe, toward)
  const radius = Math.min(Math.max(apart * 1.4 + FOLLOW.margin, FOLLOW.minRadius), FOLLOW.maxRadius)
  return { target, radius, azimuth: Math.atan2(probe[1], probe[0]) - FOLLOW.behind, elevation: FOLLOW.elevation, upAxis: ECLIPTIC_UP }
}

function heliosphereGoal(probe: Vec3, seconds: number): CameraGoal {
  const { share, radius, elevation, behind, turnRadiansPerSecond } = HELIOSPHERE
  const azimuth = Math.atan2(probe[1], probe[0]) - behind + seconds * turnRadiansPerSecond
  return { target: probe.map((value) => value * share) as Vec3, radius, azimuth, elevation, upAxis: ECLIPTIC_UP }
}

// At a flyby the camera stands at the probe (eye) looking along `look`: the orbit camera's target is
// a zoom-floor's distance ahead of it.
export function encounterGoal({ eye, look, up }: EncounterCamera, distance: number): CameraGoal {
  const back = look.map((value) => -value) as Vec3
  const { right, forward0 } = orbitBasisForUpAxis(up)
  return {
    target: eye.map((value, axis) => value + look[axis] * distance) as Vec3,
    radius: distance,
    azimuth: Math.atan2(vec3.dot(back, right), vec3.dot(back, forward0)),
    elevation: Math.asin(Math.max(-1, Math.min(1, vec3.dot(back, up)))),
    upAxis: up,
  }
}

// Moves the orbit camera toward its goal (or onto it: a cut).
export function steerCamera(orbit: OrbitCamera, goal: CameraGoal, { deltaSeconds, cut }: { deltaSeconds: number; cut: boolean }): void {
  const t = cut ? 1 : 1 - Math.exp(-deltaSeconds * FOLLOW_RATE)
  vec3.lerp(orbit.target, orbit.target, goal.target, t)
  orbit.radius = Math.exp(Math.log(orbit.radius) + (Math.log(goal.radius) - Math.log(orbit.radius)) * t)
  orbit.azimuth += shortestTurn(orbit.azimuth, goal.azimuth) * t
  orbit.elevation += (goal.elevation - orbit.elevation) * t
  vec3.set(orbit.upAxis, ...goal.upAxis)
}

function shortestTurn(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from))
}
