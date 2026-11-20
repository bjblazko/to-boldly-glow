import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchNasaPhotos } from './nasaPhotos'

// The Voyager lessons' photos (all NASA/JPL, public domain). `npm run fetch-voyager-photos`; the
// output is committed.
export const VOYAGER_PHOTOS = ['PIA21747', 'PIA21744', 'PIA01384', 'PIA00379', 'PIA00459', 'PIA01383', 'PIA00024', 'PIA01486', 'PIA18182', 'PIA00042', 'PIA01492', 'PIA02246', 'PIA23645'] as const

if (import.meta.url === `file://${process.argv[1]}`) {
  await fetchNasaPhotos(VOYAGER_PHOTOS, join(dirname(fileURLToPath(import.meta.url)), '../../app/public/images/voyager'))
}
