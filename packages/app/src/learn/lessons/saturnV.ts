import { msg } from '../../i18n/i18n'
import type { Chapter, ChapterFact, ChapterPhoto, Lesson } from '../lessonTypes'
import type { SaturnVPart, SaturnVStage } from '../apollo/saturnVStage'

const TEXT = msg.lessons.saturnV

function chapter(id: keyof typeof TEXT.chapters, saturnV: SaturnVStage, extra: Partial<Chapter> = {}): Chapter {
  return { id, ...TEXT.chapters[id], kind: 'saturnV', saturnV, seasonPhaseDegrees: 0, ...extra }
}

function fact(id: keyof typeof TEXT.facts, icon: ChapterFact['icon']): ChapterFact {
  return { icon, ...TEXT.facts[id] }
}

// A photo bundled with the app (packages/data-pipeline/src/fetchSaturnVPhotos.ts).
function photo(nasaId: string, caption: keyof typeof TEXT.captions, credit: string): ChapterPhoto {
  return { src: `images/apollo/${nasaId}.jpg`, caption: TEXT.captions[caption], credit }
}

const STACK: SaturnVPart[] = ['les', 'cm', 'sm', 'sla', 'iu', 'sivb', 'sii', 'sic']
// Everything but the command module, in the order it was left behind.
const THROWN_OFF: SaturnVPart[] = ['person', 'sic', 'sicInside', 'sicEngines', 'les', 'sii', 'siiInside', 'siiEngines', 'sivb', 'sivbInside', 'sivbEngine', 'iu', 'sla', 'lm', 'sm']

const CHAPTERS: Chapter[] = [
  chapter('whole', { shot: 'whole', labels: ['person'], heights: true }, {
    photo: photo('6901000', 'launch', 'NASA/MSFC'),
    facts: [fact('height', 'diameter'), fact('mass', 'mass'), fact('diameter', 'circumference')],
  }),
  chapter('stack', { shot: 'exploded', explode: 1, labels: STACK }, { photo: photo('KSC-69P-372', 'rollout', 'NASA/KSC') }),
  chapter('sic', { shot: 'sic', cut: 1, heights: true, highlight: 'sicInside', labels: ['sicInside', 'sicEngines'] }, {
    photo: photo('9903405', 'f1', 'NASA/MSFC'),
    facts: [fact('thrust', 'power'), fact('sicBurn', 'clock'), fact('flow', 'mass')],
  }),
  chapter('sii', { shot: 'sii', cut: 1, heights: true, highlight: 'siiInside', labels: ['siiInside', 'siiEngines'] }, {
    photo: photo('6758331', 'sii', 'NASA/MSFC'),
    facts: [fact('hydrogen', 'thermometer'), fact('siiBurn', 'clock'), fact('siiPropellant', 'mass')],
  }),
  chapter('sivb', { shot: 'sivb', cut: 1, heights: true, highlight: 'sivbInside', labels: ['sivbInside', 'sivbEngine'] }, {
    photo: photo('6861994', 'sivb', 'NASA/MSFC'),
    facts: [fact('tli', 'clock'), fact('tliSpeed', 'orbit')],
  }),
  chapter('iu', { shot: 'sivb', explode: 0.35, highlight: 'iu', labels: ['iu'] }, {
    photo: photo('0100806', 'iu', 'NASA/MSFC'),
    facts: [fact('iuHeight', 'diameter')],
  }),
  chapter('spacecraft', { shot: 'top', explode: 1, cut: 1, highlight: 'lm', labels: ['les', 'cm', 'sm', 'lm', 'sla'] }),
  chapter('returns', { shot: 'capsule', gone: THROWN_OFF, labels: ['cm'] }, { facts: [fact('capsule', 'mass')] }),
]

export const SATURN_V_LESSON: Lesson = {
  id: 'saturnV',
  title: TEXT.title,
  chapters: CHAPTERS,
  markerLatitudeDegrees: 0, // unused by Saturn V chapters - see lessonTypes.ts's doc comment
  note: TEXT.note,
}
