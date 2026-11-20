import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchNasaPhotos } from './nasaPhotos'

// The Columbia lesson's photos, NASA (Headquarters and Johnson Space Center), public domain:
// Columbia after splashdown, the command module aboard the USS Hornet with its charred heat
// shield, Michael Collins in the command module simulator. `npm run fetch-columbia-photos`; the
// output is committed.
export const COLUMBIA_PHOTOS = ['372772main_GPN-2000-001212_full', 'S69-40758', 'S69-38317'] as const

if (import.meta.url === `file://${process.argv[1]}`) {
  await fetchNasaPhotos(COLUMBIA_PHOTOS, join(dirname(fileURLToPath(import.meta.url)), '../../app/public/images/apollo'))
}
