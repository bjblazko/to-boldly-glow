import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchNasaPhotos } from './nasaPhotos'

// The Saturn V lesson's photos, NASA (Marshall and Kennedy centres), public domain: Apollo 11's
// launch and rollout, an F-1 engine, the S-II being stacked (Apollo 6), the S-IVB on its test stand, the Instrument Unit's chart.
// `npm run fetch-saturn-v-photos`; the output is committed.
export const SATURN_V_PHOTOS = ['6901000', 'KSC-69P-372', '9903405', '6758331', '6861994', '0100806'] as const

if (import.meta.url === `file://${process.argv[1]}`) {
  await fetchNasaPhotos(SATURN_V_PHOTOS, join(dirname(fileURLToPath(import.meta.url)), '../../app/public/images/apollo'))
}
