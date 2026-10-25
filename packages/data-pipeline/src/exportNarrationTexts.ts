// Writes every narration text the app speaks to narration/texts.json, for synthesize.py: one entry
// per language and segment, with the hash the app's manifest test checks the audio against.
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { narrationSegments } from '../../app/src/narration/narrationSegments'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'narration', 'texts.json')

writeFileSync(OUT, JSON.stringify(narrationSegments(), null, 2) + '\n')
console.log(`Wrote ${narrationSegments().length} narration texts to ${OUT}`)
