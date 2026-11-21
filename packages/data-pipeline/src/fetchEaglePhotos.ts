import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchNasaPhotos } from './nasaPhotos'

// The Eagle lesson's photos, NASA (Johnson Space Center), public domain, each caption checked for
// another credit (none): Eagle on the Moon with Aldrin beside it, Eagle in lunar orbit with its
// legs out, Aldrin backing out through the hatch, the ascent stage coming back to Columbia.
// `npm run fetch-eagle-photos`; the output is committed.
export const EAGLE_PHOTOS = ['as11-40-5927', 'as11-44-6581', 'as11-40-5863', 'as11-44-6642'] as const

if (import.meta.url === `file://${process.argv[1]}`) {
  await fetchNasaPhotos(EAGLE_PHOTOS, join(dirname(fileURLToPath(import.meta.url)), '../../app/public/images/apollo'))
}
