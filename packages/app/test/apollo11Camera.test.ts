import { describe, expect, it } from 'vitest'
import { tourCamera, type ShotMemory } from '../src/missions/apollo11/apollo11Camera'
import { Apollo11Clock } from '../src/missions/apollo11/apollo11Clock'
import { Apollo11Scene } from '../src/missions/apollo11/apollo11Scene'
import { APOLLO11_STATIONS } from '../src/missions/apollo11/apollo11Stations'
import { realApollo11Trajectory } from './support/apollo11Files'

describe("the tour's camera over the whole tour", () => {
  it('is always a real place and never jumps within a shot', () => {
    const scene = new Apollo11Scene(realApollo11Trajectory())
    const clock = new Apollo11Clock(APOLLO11_STATIONS, { arrived: () => {}, ended: () => {} }, true)
    clock.start()
    const starts = APOLLO11_STATIONS.map((_, i) => APOLLO11_STATIONS.slice(0, i).reduce((sum, s) => sum + s.seconds, 0))
    const memory: { shot: ShotMemory | null } = { shot: null }
    const problems: string[] = []
    let last = null as { key: string; eye: number[] } | null
    // Ten frames a second, all but the last second (the path ends at entry interface).
    for (let t = 0; t < clock.length - 1; t += 0.1) {
      clock.seek(t)
      const { stationIndex, get, take } = clock.moment
      const camera = tourCamera(scene, { stationId: APOLLO11_STATIONS[stationIndex].id, stationSeconds: t - starts[stationIndex], get, take, inOrbit: APOLLO11_STATIONS[stationIndex].maxRate !== undefined }, memory)
      if (!camera) continue
      const { eyeKm, lookKm, up, fov } = camera.framing
      if (![...eyeKm, ...lookKm, ...up, fov].every(Number.isFinite)) problems.push(`not a number at ${t.toFixed(1)} s`)
      if (last?.key === camera.shotKey) {
        const step = Math.hypot(...eyeKm.map((v, i) => v - last!.eye[i])) * 1000
        const distance = Math.hypot(...eyeKm) * 1000
        if (step > 0.05 * distance + 1) problems.push(`a ${step.toFixed(0)} m jump at ${t.toFixed(1)} s (${camera.shotKey})`)
      }
      last = { key: camera.shotKey, eye: [...eyeKm] }
    }
    expect(problems.slice(0, 10)).toEqual([])
  }, 300_000)
})
