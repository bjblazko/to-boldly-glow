import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { horizonsVectorsUrl, parseHorizonsVectors } from './voyager/horizons'
import { simplifyTrajectory, speedSeries, trajectoryBinary } from './voyager/trajectorySamples'

// Fetches both Voyagers' trajectories from JPL Horizons, daily from the day after launch to 2030
// (Horizons extrapolates beyond today), and writes them for the app: the path, thinned out to
// within 0.001 AU, and the speed against the Sun's escape speed every ten days (the deep-dive
// lesson's gravity-assist chart). `npm run fetch-voyager-trajectories`; the output is committed.
const PROBES = [
  { id: 'voyager1', target: '-31', start: '1977-09-06' },
  { id: 'voyager2', target: '-32', start: '1977-08-21' },
]
const STOP = '2030-01-01'
const TOLERANCE_AU = 0.001
const SPEED_STEP_DAYS = 10

async function fetchProbe(target: string, start: string) {
  const response = await fetch(horizonsVectorsUrl(target, { start, stop: STOP, step: '1d' }))
  if (!response.ok) throw new Error(`Horizons answered ${response.status}`)
  return parseHorizonsVectors(await response.text())
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = join(dirname(fileURLToPath(import.meta.url)), '../../app/public/data/voyager')
  mkdirSync(out, { recursive: true })
  const speeds: Record<string, [number, number, number][]> = {}
  for (const { id, target, start } of PROBES) {
    const vectors = await fetchProbe(target, start)
    const path = simplifyTrajectory(vectors, TOLERANCE_AU)
    writeFileSync(join(out, `${id}.trajectory.bin`), trajectoryBinary(path))
    speeds[id] = speedSeries(vectors, SPEED_STEP_DAYS)
    console.log(`${id}: ${vectors.length} daily samples, ${path.length} kept`)
  }
  writeFileSync(join(out, 'speeds.json'), JSON.stringify({ retrieved: new Date().toISOString().slice(0, 10), columns: ['year', 'speedKmS', 'escapeKmS'], ...speeds }) + '\n')
}
