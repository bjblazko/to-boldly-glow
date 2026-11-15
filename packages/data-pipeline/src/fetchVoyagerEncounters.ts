import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { horizonsVectorsUrl, parseHorizonsVectors, type StateVector } from './voyager/horizons'

// Fetches each Voyager flyby from JPL Horizons at true scale: the probe and one moon the tour names,
// relative to the planet's centre, every 5 minutes for 36 hours either side of closest approach.
// Writes packages/app/public/data/voyager/encounters/<probe>-<planet>.bin - float32 records of
// [seconds from closest approach, probe x, y, z, moon x, y, z] in km, ecliptic J2000 - and an index,
// encounters.json. `npm run fetch-voyager-encounters`; the output is committed.

interface Encounter {
  probe: 'voyager1' | 'voyager2'
  planet: string
  // Horizons' ids: the probe, the planet's centre, the moon.
  target: string
  center: string
  moon: { id: string; horizons: string }
  // Closest approach as NASA/JPL give it (UTC); the data's own minimum is what is stored.
  approx: string
}

const ENCOUNTERS: Encounter[] = [
  { probe: 'voyager1', planet: 'jupiter', target: '-31', center: '500@599', moon: { id: 'io', horizons: '501' }, approx: '1979-03-05T12:05' },
  { probe: 'voyager1', planet: 'saturn', target: '-31', center: '500@699', moon: { id: 'titan', horizons: '606' }, approx: '1980-11-12T23:46' },
  { probe: 'voyager2', planet: 'jupiter', target: '-32', center: '500@599', moon: { id: 'europa', horizons: '502' }, approx: '1979-07-09T22:29' },
  { probe: 'voyager2', planet: 'saturn', target: '-32', center: '500@699', moon: { id: 'titan', horizons: '606' }, approx: '1981-08-26T03:24' },
  { probe: 'voyager2', planet: 'uranus', target: '-32', center: '500@799', moon: { id: 'titania', horizons: '703' }, approx: '1986-01-24T17:59' },
  { probe: 'voyager2', planet: 'neptune', target: '-32', center: '500@899', moon: { id: 'triton', horizons: '801' }, approx: '1989-08-25T03:56' },
]
const SPAN_HOURS = 36
const STEP = '5m'
const SECONDS_PER_DAY = 86400

function shifted(iso: string, hours: number): string {
  return new Date(Date.parse(`${iso}Z`) + hours * 3600000).toISOString().slice(0, 16).replace('T', ' ')
}

async function vectors(target: string, encounter: Encounter): Promise<StateVector[]> {
  const query = { start: shifted(encounter.approx, -SPAN_HOURS), stop: shifted(encounter.approx, SPAN_HOURS), step: STEP, center: encounter.center, units: 'KM-S' as const }
  const response = await fetch(horizonsVectorsUrl(target, query))
  if (!response.ok) throw new Error(`Horizons answered ${response.status}`)
  return parseHorizonsVectors(await response.text())
}

// The sample nearest the planet: the flyby's moment, which the records count their time from.
export function closestApproach(probe: StateVector[]): StateVector {
  return probe.reduce((best, vector) => (Math.hypot(...vector.position) < Math.hypot(...best.position) ? vector : best))
}

export function encounterRecords(probe: StateVector[], moon: StateVector[]): Float32Array {
  const zero = closestApproach(probe).julianDay
  const records = new Float32Array(probe.length * 7)
  probe.forEach((vector, index) => records.set([(vector.julianDay - zero) * SECONDS_PER_DAY, ...vector.position, ...moon[index].position], index * 7))
  return records
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = join(dirname(fileURLToPath(import.meta.url)), '../../app/public/data/voyager/encounters')
  mkdirSync(out, { recursive: true })
  const index = []
  for (const encounter of ENCOUNTERS) {
    const [probe, moon] = [await vectors(encounter.target, encounter), await vectors(encounter.moon.horizons, encounter)]
    const closest = closestApproach(probe)
    writeFileSync(join(out, `${encounter.probe}-${encounter.planet}.bin`), Buffer.from(encounterRecords(probe, moon).buffer))
    const julianDay = closest.julianDay
    index.push({ probe: encounter.probe, planet: encounter.planet, moon: encounter.moon.id, closestApproachJulianDay: julianDay, closestApproachKm: Math.round(Math.hypot(...closest.position)) })
    console.log(`${encounter.probe} at ${encounter.planet}: ${probe.length} samples, closest ${Math.round(Math.hypot(...closest.position))} km`)
  }
  writeFileSync(join(out, 'encounters.json'), JSON.stringify({ retrieved: new Date().toISOString().slice(0, 10), encounters: index }, null, 1) + '\n')
}
