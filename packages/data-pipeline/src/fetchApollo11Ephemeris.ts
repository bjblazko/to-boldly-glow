import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { horizonsVectorsUrl, parseHorizonsVectors } from './voyager/horizons'

// The Moon's and the Sun's geocentric positions through Apollo 11's flight (16 to 25 July 1969),
// every ten minutes, from JPL Horizons (DE441): Earth's mean equator and equinox of J2000, km,
// UT. The trajectory reconstruction (apollo/trajectory/) integrates in their field.
// `npm run fetch-apollo11-ephemeris`; the output (data/apollo11-ephemeris.json) is committed.

const START = '1969-07-16 13:00'
const STOP = '1969-07-25 00:00'
const STEP = '10m'

async function body(target: string): Promise<number[][]> {
  const response = await fetch(horizonsVectorsUrl(target, { start: START, stop: STOP, step: STEP, center: '500@399', units: 'KM-S', plane: 'FRAME', universalTime: true }))
  if (!response.ok) throw new Error(`Horizons answered ${response.status}`)
  return parseHorizonsVectors(await response.text()).map(({ julianDay, position }) => [julianDay, ...position.map((value) => Math.round(value * 1000) / 1000)])
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [moon, sun] = await Promise.all([body('301'), body('10')])
  const out = join(dirname(fileURLToPath(import.meta.url)), '../data/apollo11-ephemeris.json')
  writeFileSync(out, JSON.stringify({ source: 'JPL Horizons (DE441), geocentric, Earth mean equator and equinox of J2000, km, UT Julian days', start: START, stop: STOP, step: STEP, moon, sun }) + '\n')
  console.log(`moon ${moon.length} and sun ${sun.length} positions`)
}
