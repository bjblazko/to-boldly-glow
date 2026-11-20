import { msg } from '../../i18n/i18n'
import type { Chapter, ChapterFact, Lesson } from '../lessonTypes'
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

// Inside, everything of the outside is gone and the cabin shows (it is "inside": seen when cut).
const OUTSIDE: ColumbiaPart[] = ['cm', 'sm', 'smInside', 'sps', 'rcs', 'antenna', 'person']
const INSIDE: ColumbiaStage = { shot: 'inside', cut: 1, still: true, gone: OUTSIDE }

const CHAPTERS: Chapter[] = [
  chapter('whole', { shot: 'whole', labels: ['cm', 'sm', 'person'], heights: true }, { facts: [fact('crew', 'clock')] }),
  chapter('serviceModule', { shot: 'serviceModule', cut: 1, highlight: 'smInside', labels: ['smInside', 'sps'] }, {
    facts: [fact('smMass', 'mass'), fact('propellant', 'power')],
  }),
  chapter('engine', { shot: 'engine', highlight: 'sps', labels: ['sps', 'antenna'] }, { facts: [fact('thrust', 'power')] }),
  chapter('commandModule', { shot: 'commandModule', explode: 1, cut: 1, highlight: 'cm', labels: ['cm', 'rcs'] }, {
    facts: [fact('cmHeight', 'diameter'), fact('diameter', 'circumference')],
  }),
  chapter('inside', { ...INSIDE, labels: ['panels', 'seats'] }, { facts: [fact('room', 'atmosphere')] }),
  chapter('panels', { ...INSIDE, shot: 'panels', labels: ['panels'] }),
  chapter('seats', { ...INSIDE, shot: 'seats', labels: ['seats'] }),
  chapter('notes', { ...INSIDE, shot: 'notes', labels: ['notes'] }),
]

export const COLUMBIA_LESSON: Lesson = {
  id: 'columbia',
  title: TEXT.title,
  chapters: CHAPTERS,
  markerLatitudeDegrees: 0, // unused by vehicle chapters - see lessonTypes.ts's doc comment
  note: TEXT.note,
}
