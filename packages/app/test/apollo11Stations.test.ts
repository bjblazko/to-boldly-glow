import { describe, expect, it } from 'vitest'
import { APOLLO11_ORIGINAL, APOLLO11_STATIONS } from '../src/missions/apollo11/apollo11Stations'
import { realApollo11Trajectory } from './support/apollo11Files'
import { getSeconds } from '../src/missions/apollo11/apollo11Events'
import { parseDeepLink, resolveDeepLink } from '../src/app/deepLink'
import AUDIO from '../src/learn/lessons/apollo11Audio.json'

const trajectory = realApollo11Trajectory()
const inWindow = (id: string, time: string) => APOLLO11_STATIONS.find((s) => s.id === id)!.realTime!.some((w) => w.from <= getSeconds(time) && getSeconds(time) <= w.to)

describe("the Apollo 11 tour's stations", () => {
  it('are the thirteen of the spec, in mission order, not overlapping', () => {
    expect(APOLLO11_STATIONS.map((s) => s.id)).toEqual(['earthOrbit', 'tli', 'docking', 'coast', 'loi', 'undocking', 'landing', 'firstStep', 'columbiaAlone', 'liftoff', 'rendezvous', 'tei', 'entry'])
    APOLLO11_STATIONS.slice(1).forEach((s, i) => expect(s.from).toBeGreaterThanOrEqual(APOLLO11_STATIONS[i].to))
  })

  it('last some 24 to 27 minutes outside', () => {
    const minutes = APOLLO11_STATIONS.reduce((sum, s) => sum + s.seconds, 0) / 60
    expect(minutes).toBeGreaterThanOrEqual(24)
    expect(minutes).toBeLessThanOrEqual(27)
  })

  it('lie on the reconstructed path', () => {
    for (const s of APOLLO11_STATIONS) {
      expect(s.from).toBeGreaterThanOrEqual(trajectory.start)
      expect(s.to).toBeLessThanOrEqual(trajectory.end + 0.01)
    }
  })

  it('show the key moments in real time', () => {
    expect(inWindow('tli', '002:44:16.20')).toBe(true)
    expect(inWindow('docking', '003:24:03.70')).toBe(true)
    expect(inWindow('landing', '102:45:39.90')).toBe(true)
    expect(inWindow('firstStep', '109:24:15.00')).toBe(true)
    expect(inWindow('liftoff', '124:22:00.79')).toBe(true)
    expect(inWindow('entry', '195:03:05.70')).toBe(true)
  })

  it("play the lesson's original audio at its station", () => {
    for (const clip of Object.values(APOLLO11_ORIGINAL)) expect(Object.keys(AUDIO)).toContain(clip)
  })

  it('can be linked to', () => {
    expect(resolveDeepLink(parseDeepLink('#tour/apollo11/landing')!)).toEqual({ kind: 'tour', tour: 'apollo11', partIndex: 6 })
  })
})
