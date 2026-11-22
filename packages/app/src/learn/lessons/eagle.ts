import { msg } from '../../i18n/i18n'
import type { Chapter, ChapterFact, ChapterPhoto, Lesson } from '../lessonTypes'
import type { EaglePart } from '../apollo/eagleVehicle'
import type { VehicleStage } from '../vehicle/vehicleStage'

const TEXT = msg.lessons.eagle

// A chapter's stage: which parts are labelled, picked out and gone (Eagle's parts), the shot.
type EagleStage = Omit<VehicleStage, 'vehicle' | 'labels' | 'highlight' | 'gone'> & { labels?: EaglePart[]; highlight?: EaglePart; gone?: EaglePart[] }

function chapter(id: keyof typeof TEXT.chapters, stage: EagleStage, extra: Partial<Chapter> = {}): Chapter {
  return { id, ...TEXT.chapters[id], kind: 'vehicle', vehicle: { vehicle: 'eagle', ...stage }, seasonPhaseDegrees: 0, ...extra }
}

function fact(id: keyof typeof TEXT.facts, icon: ChapterFact['icon']): ChapterFact {
  return { icon, ...TEXT.facts[id] }
}

// A photo bundled with the app (packages/data-pipeline/src/fetchEaglePhotos.ts).
function photo(nasaId: string, caption: keyof typeof TEXT.captions): ChapterPhoto {
  return { src: `images/apollo/${nasaId}.jpg`, caption: TEXT.captions[caption], credit: 'NASA/JSC' }
}

// Inside, everything of the outside is gone and the cockpit shows (it is "inside": seen when cut).
const OUTSIDE: EaglePart[] = ['descent', 'descentInside', 'leg0', 'leg1', 'leg2', 'leg3', 'link0', 'link1', 'link2', 'link3', 'probes', 'ascent', 'ascentInside', 'person']
const INSIDE: EagleStage = { shot: 'inside', cut: 1, still: true, gone: OUTSIDE }

const CHAPTERS: Chapter[] = [
  chapter('whole', { shot: 'whole', labels: ['descent', 'ascent', 'person'], heights: true }, { photo: photo('as11-40-5927', 'surface'), facts: [fact('height', 'diameter'), fact('width', 'circumference')] }),
  // Folded, the probes and secondary struts lie stowed against the legs (not drawn).
  chapter('folded', { shot: 'folded', fold: 1, labels: ['leg0'], gone: ['probes', 'person'] }, { photo: photo('as11-44-6581', 'orbit') }),
  chapter('stages', { shot: 'stages', explode: 1, labels: ['descent', 'ascent'] }, { facts: [fact('mass', 'mass')] }),
  chapter('descent', { shot: 'descent', cut: 1, highlight: 'descentInside', labels: ['descentInside'] }, { facts: [fact('descentEngine', 'power')] }),
  chapter('ascent', { shot: 'ascent', cut: 1, highlight: 'ascentInside', labels: ['ascentInside'] }, { facts: [fact('ascentEngine', 'power')] }),
  chapter('inside', { ...INSIDE, labels: ['windows', 'panels'] }, { photo: photo('as11-40-5863', 'hatch'), facts: [fact('room', 'atmosphere')] }),
  chapter('panels', { ...INSIDE, shot: 'panels', labels: ['panels', 'dsky', 'windows'] }),
  chapter('liftoff', { shot: 'liftoff', explode: 1, highlight: 'ascent', labels: ['ascent', 'descent'], gone: ['probes', 'person'] }, { photo: photo('as11-44-6642', 'rendezvous') }),
]

export const EAGLE_LESSON: Lesson = {
  id: 'eagle',
  title: TEXT.title,
  chapters: CHAPTERS,
  markerLatitudeDegrees: 0, // unused by vehicle chapters - see lessonTypes.ts's doc comment
  note: TEXT.note,
}
