import { msg } from '../../i18n/i18n'
import type { Chapter, ChapterFact, ChapterPhoto, Lesson } from '../lessonTypes'
import type { ColumbiaPart } from '../apollo/columbiaVehicle'
import type { VehicleStage } from '../vehicle/vehicleStage'

const TEXT = msg.lessons.columbia

// A chapter's stage: which parts are labelled, picked out and gone (Columbia's parts), the shot.
type ColumbiaStage = Omit<VehicleStage, 'vehicle' | 'labels' | 'highlight' | 'gone'> & { labels?: ColumbiaPart[]; highlight?: ColumbiaPart; gone?: ColumbiaPart[] }

function chapter(id: keyof typeof TEXT.chapters, stage: ColumbiaStage, extra: Partial<Chapter> = {}): Chapter {
  return { id, ...TEXT.chapters[id], kind: 'vehicle', vehicle: { vehicle: 'columbia', ...stage }, seasonPhaseDegrees: 0, ...extra }
}

function fact(id: keyof typeof TEXT.facts, icon: ChapterFact['icon']): ChapterFact {
  return { icon, ...TEXT.facts[id] }
}

// A photo bundled with the app (packages/data-pipeline/src/fetchColumbiaPhotos.ts).
function photo(nasaId: string, caption: keyof typeof TEXT.captions, credit: string): ChapterPhoto {
  return { src: `images/apollo/${nasaId}.jpg`, caption: TEXT.captions[caption], credit }
}

// Inside, everything of the outside is gone and a cabin shows (it is "inside": seen when cut): the
// cabin as it flew (NASSP's cockpit), or as it is today (the Smithsonian's scan). Outside, a cut
// shows the cabin as it flew.
const OUTSIDE: ColumbiaPart[] = ['cm', 'sm', 'smInside', 'sps', 'rcs', 'antenna', 'person']
const TODAY: ColumbiaPart[] = ['hull', 'panels', 'seats', 'notes']
const AS_FLOWN: ColumbiaPart[] = ['vcCabin', 'vcPanels', 'vcHatches', 'vcCouches']
const INSIDE: ColumbiaStage = { shot: 'inside', cut: 1, still: true, gone: [...OUTSIDE, ...TODAY] }
const INSIDE_TODAY: ColumbiaStage = { shot: 'today', cut: 1, still: true, gone: [...OUTSIDE, ...AS_FLOWN] }

const CHAPTERS: Chapter[] = [
  chapter('whole', { shot: 'whole', labels: ['cm', 'sm', 'person'], heights: true, gone: TODAY }, {
    photo: photo('372772main_GPN-2000-001212_full', 'splashdown', 'NASA'),
    facts: [fact('crew', 'clock')],
  }),
  chapter('serviceModule', { shot: 'serviceModule', cut: 1, highlight: 'smInside', labels: ['smInside', 'sps'], gone: TODAY }, {
    facts: [fact('smMass', 'mass'), fact('propellant', 'power')],
  }),
  chapter('engine', { shot: 'engine', highlight: 'sps', labels: ['sps', 'antenna'], gone: TODAY }, { facts: [fact('thrust', 'power')] }),
  chapter('commandModule', { shot: 'commandModule', explode: 1, cut: 1, highlight: 'cm', labels: ['cm', 'rcs'], gone: TODAY }, {
    photo: photo('S69-40758', 'hornet', 'NASA/JSC'),
    facts: [fact('cmHeight', 'diameter'), fact('diameter', 'circumference')],
  }),
  chapter('inside', { ...INSIDE, labels: ['vcPanels', 'vcCouches'] }, { facts: [fact('room', 'atmosphere')] }),
  chapter('panels', { ...INSIDE, shot: 'panels', labels: ['vcPanels'] }, { photo: photo('S69-38317', 'simulator', 'NASA/JSC') }),
  chapter('seats', { ...INSIDE, shot: 'seats', labels: ['vcCouches'] }),
  chapter('today', { ...INSIDE_TODAY, labels: ['panels', 'seats'] }),
  chapter('notes', { ...INSIDE_TODAY, shot: 'notes', closingShot: 'centerCouch', labels: ['notes'] }),
]

export const COLUMBIA_LESSON: Lesson = {
  id: 'columbia',
  title: TEXT.title,
  chapters: CHAPTERS,
  markerLatitudeDegrees: 0, // unused by vehicle chapters - see lessonTypes.ts's doc comment
  note: TEXT.note,
}
