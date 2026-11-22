import { msg } from '../../i18n/i18n'
import type { Chapter, ChapterFact, ChapterPhoto, Lesson } from '../lessonTypes'
import type { LauncherPart } from '../apollo/launcherVehicle'
import type { VehicleStage } from '../vehicle/vehicleStage'

const TEXT = msg.lessons.launcher

// A chapter's stage: which parts are labelled, picked out and gone, the shot.
type LauncherStage = Omit<VehicleStage, 'vehicle' | 'labels' | 'highlight' | 'gone'> & { labels?: LauncherPart[]; highlight?: LauncherPart; gone?: LauncherPart[] }

function chapter(id: keyof typeof TEXT.chapters, stage: LauncherStage, extra: Partial<Chapter> = {}): Chapter {
  return { id, ...TEXT.chapters[id], kind: 'vehicle', vehicle: { vehicle: 'launcher', ...stage }, seasonPhaseDegrees: 0, ...extra }
}

function fact(id: keyof typeof TEXT.facts, icon: ChapterFact['icon']): ChapterFact {
  return { icon, ...TEXT.facts[id] }
}

// A photo bundled with the app (the Saturn V lesson's, packages/data-pipeline/src/fetchSaturnVPhotos.ts).
function photo(nasaId: string, caption: keyof typeof TEXT.captions, credit: string): ChapterPhoto {
  return { src: `images/apollo/${nasaId}.jpg`, caption: TEXT.captions[caption], credit }
}

// The crawler shows only while it carries the launcher.
const NO_CRAWLER: LauncherPart[] = ['crawler']

const CHAPTERS: Chapter[] = [
  chapter('whole', { shot: 'whole', labels: ['rocket', 'tower', 'launcher', 'person'], heights: true, gone: NO_CRAWLER }, { facts: [fact('tower', 'diameter'), fact('weight', 'mass')] }),
  chapter('tower', { shot: 'tower', highlight: 'tower', labels: ['tower'], gone: NO_CRAWLER }, { facts: [fact('platforms', 'diameter'), fact('elevators', 'clock')] }),
  chapter('arms', { shot: 'arms', highlight: 'serviceArms', labels: ['serviceArms', 'intertankArm', 'crewArm'], gone: NO_CRAWLER }, { facts: [fact('arms', 'power')] }),
  chapter('crewArm', { shot: 'crewArm', highlight: 'crewArm', labels: ['crewArm', 'damperArm'], gone: NO_CRAWLER }),
  chapter('holddown', { shot: 'base', highlight: 'holddown', labels: ['holddown', 'mast1'], gone: NO_CRAWLER }, { facts: [fact('holddown', 'clock')] }),
  chapter('crawler', { shot: 'crawler', explode: 1, highlight: 'crawler', labels: ['crawler', 'launcher'] }, {
    photo: photo('KSC-69P-372', 'rollout', 'NASA/KSC'),
    facts: [fact('crawlerMass', 'mass'), fact('crawlerSpeed', 'clock'), fact('crawlerway', 'circumference')],
  }),
  chapter('liftoff', { shot: 'liftoff', fold: 1, labels: ['serviceArms', 'crewArm', 'mast1'], gone: NO_CRAWLER }, { photo: photo('6901000', 'liftoff', 'NASA/MSFC') }),
]

export const LAUNCHER_LESSON: Lesson = {
  id: 'launcher',
  title: TEXT.title,
  chapters: CHAPTERS,
  markerLatitudeDegrees: 0, // unused by vehicle chapters - see lessonTypes.ts's doc comment
  note: TEXT.note,
}
