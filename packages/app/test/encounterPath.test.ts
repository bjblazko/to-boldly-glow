import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { EncounterPath } from '../src/missions/encounterPath'

function path(name: string): EncounterPath {
  const bytes = readFileSync(join(__dirname, '..', 'public', 'data', 'voyager', 'encounters', `${name}.bin`))
  return new EncounterPath(new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4))
}

// Closest approaches from the planets' centres, as NASA/JPL give them.
describe('the flyby paths', () => {
  it.each([
    ['voyager1-jupiter', 348_890],
    ['voyager2-neptune', 29_240],
  ])('pass %s at its published distance at closest approach', (name, km) => {
    const flyby = path(name)
    expect(Math.hypot(...flyby.probeAt(0))).toBeCloseTo(km, -3)
    expect(Math.hypot(...flyby.probeAt(-3600))).toBeGreaterThan(Math.hypot(...flyby.probeAt(0)))
  })

  it('knows which way the probe flies', () => {
    const flyby = path('voyager1-saturn')
    const [a, b] = [flyby.probeAt(0), flyby.probeAt(600)]
    const direction = flyby.directionAt(300)
    const step = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
    const along = (direction[0] * step[0] + direction[1] * step[1] + direction[2] * step[2]) / Math.hypot(...step)
    expect(along).toBeGreaterThan(0.99)
  })
})
