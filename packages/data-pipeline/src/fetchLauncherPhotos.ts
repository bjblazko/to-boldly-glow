import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchNasaPhotos } from './nasaPhotos'

// The launch tower lesson's own photos, NASA, public domain, each caption checked for another credit
// (none): Armstrong and Aldrin on their way to the spacecraft, 16 July 1969 (KSC-69PC-399); the
// White Room at the hatch, Apollo 10 (S69-35316, JSC); Apollo 17's crew on the access arm in an
// emergency egress test (KSC-72PC-0610); Apollo 11's first stage stacked on its mobile launcher in
// the Vehicle Assembly Building (KSC-69P-168); a crawler being built, 1964 (KSC-64-3716); Apollo 11
// rising past its tower, from a camera on the tower looking down at the platform (S69-39961, JSC).
// `npm run fetch-launcher-photos`; the output is committed.
export const LAUNCHER_PHOTOS = ['KSC-69PC-399', 's69-35316', 'KSC-72PC-0610', 'KSC-69P-168', 'KSC-20100330-PH-KSC-64-3716', 'S69-39961'] as const

if (import.meta.url === `file://${process.argv[1]}`) {
  await fetchNasaPhotos(LAUNCHER_PHOTOS, join(dirname(fileURLToPath(import.meta.url)), '../../app/public/images/apollo'))
}
