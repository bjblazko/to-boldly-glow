import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Picks a Voyager's crossing of the heliopause (Voyager 1: 25 August 2012, Voyager 2: 5 November
// 2018) out of NASA SPDF's merged daily data: the magnetic field strength and the flux of 3.0-4.6
// MeV protons (Cosmic Ray Subsystem), daily for about ten months around it. Protons from inside the
// heliosphere vanish; the field jumps. Writes packages/app/public/data/voyager/heliopause-<probe>.json.
//
// `npm run extract-heliopause -- <voyagerN_daily.asc> <voyager1|voyager2>`, from
// https://spdf.gsfc.nasa.gov/pub/data/voyager/voyagerN/merged/voyagerN_daily.asc (format in
// vy1mgd.txt next to it; SHA-256 of the files used: see CREDITS.md). Words 1-2: year and day of
// year; word 7: field magnitude, nT; word 20: 3.0-4.6 MeV protons, 1/(cm^2 s sr MeV). Missing
// values are filled with nines.
const RANGES = {
  voyager1: { first: { year: 2012, day: 122 }, last: { year: 2013, day: 60 } },
  voyager2: { first: { year: 2018, day: 200 }, last: { year: 2019, day: 120 } },
}
type Probe = keyof typeof RANGES
type Day = { year: number; day: number }
const FIELD_WORD = 7
const PROTON_WORD = 20

const FILL_VALUE = /^9+(\.9+)?$|^9\.999e\+05$/

function measured(text: string): number | null {
  return FILL_VALUE.test(text) ? null : Number(text)
}

function inRange(year: number, day: number, { first, last }: { first: Day; last: Day }): boolean {
  const key = year * 1000 + day
  return key >= first.year * 1000 + first.day && key <= last.year * 1000 + last.day
}

// The date of a day of the year, as YYYY-MM-DD.
function isoDate(year: number, day: number): string {
  return new Date(Date.UTC(year, 0, day)).toISOString().slice(0, 10)
}

export function heliopauseRows(text: string, probe: Probe): [string, number | null, number | null][] {
  return text
    .split('\n')
    .map((line) => line.trim().split(/\s+/))
    .filter((words) => words.length > PROTON_WORD && inRange(Number(words[0]), Number(words[1]), RANGES[probe]))
    .map((words) => [isoDate(Number(words[0]), Number(words[1])), measured(words[PROTON_WORD - 1]), measured(words[FIELD_WORD - 1])])
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [input, probe] = process.argv.slice(2) as [string, Probe]
  if (!input || !(probe in RANGES)) throw new Error('usage: extract-heliopause <voyagerN_daily.asc> <voyager1|voyager2>')
  const out = join(dirname(fileURLToPath(import.meta.url)), `../../app/public/data/voyager/heliopause-${probe}.json`)
  const rows = heliopauseRows(readFileSync(input, 'utf8'), probe)
  writeFileSync(out, JSON.stringify({ columns: ['date', 'protons3to4p6MeV', 'fieldNt'], rows }) + '\n')
  console.log(`Wrote ${rows.length} days to ${out}`)
}
