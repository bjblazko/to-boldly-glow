import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchNasaPhotos } from './nasaPhotos'

// The Apollo 11 lesson's own photos, NASA, public domain, each caption checked for another credit
// (none): Marshall's sketches of July 1969 of the transposition and docking (6902077) and of the
// liftoff from the Moon and the rendezvous (6902073); the ground beside Eagle through its right-hand
// window (as11-37-5458) and the ascent stage coming up to Columbia from below (as11-44-6626), JSC.
// `npm run fetch-apollo11-photos`; the output is committed.
export const APOLLO11_PHOTOS = ['6902077', 'as11-37-5458', '6902073', 'as11-44-6626'] as const

if (import.meta.url === `file://${process.argv[1]}`) {
  await fetchNasaPhotos(APOLLO11_PHOTOS, join(dirname(fileURLToPath(import.meta.url)), '../../app/public/images/apollo'))
}
