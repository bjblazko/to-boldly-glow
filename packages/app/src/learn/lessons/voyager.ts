import { msg } from '../../i18n/i18n'
import type { Chapter, ChapterFact, ChapterPhoto, Lesson } from '../lessonTypes'
import type { VoyagerStage } from '../voyager/voyagerStage'

const TEXT = msg.lessons.voyager
const FACTS = msg.voyager.facts

// Only 'orbit' and 'staged' chapters read seasonPhaseDegrees (see lessonTypes.ts).
function chapter(id: keyof typeof TEXT.chapters, kind: Chapter['kind'], voyager: VoyagerStage, extra: Partial<Chapter> = {}): Chapter {
  return { id, ...TEXT.chapters[id], kind, voyager, seasonPhaseDegrees: 0, ...extra }
}

export function voyagerFact(id: keyof typeof FACTS, icon: ChapterFact['icon']): ChapterFact {
  return { icon, ...FACTS[id] }
}

// A photo bundled with the app (packages/data-pipeline/src/fetchVoyagerPhotos.ts).
export function voyagerPhoto(nasaId: string, caption: string, credit = 'NASA/JPL'): ChapterPhoto {
  return { src: `images/voyager/${nasaId}.jpg`, caption, credit }
}

// NASA's page of the Golden Record's contents: the pictures and music are not ours to bundle.
const RECORD_CONTENTS_URL = 'https://science.nasa.gov/mission/voyager/golden-record-contents/'

const CHAPTERS: Chapter[] = [
  chapter('two-probes', 'voyagerProbe', {}, {
    photo: voyagerPhoto('PIA21747', TEXT.captions.launch, 'NASA/JPL-Caltech/KSC'),
    facts: [voyagerFact('launched', 'clock'), voyagerFact('mass', 'mass'), voyagerFact('dish', 'diameter'), voyagerFact('farthest', 'sun-distance')],
  }),
  chapter('on-board', 'voyagerProbe', { labels: ['dish', 'science', 'rtg', 'magnetometer', 'record'] }),
  chapter('golden-record', 'voyagerRecord', { side: 'label' }, { links: [{ label: TEXT.links.recordContents, url: RECORD_CONTENTS_URL }] }),
  chapter('instructions', 'voyagerRecord', { side: 'cover', features: ['playing', 'stylus', 'signal', 'firstImage', 'pulsarMap', 'hydrogen'] }),
  chapter('alignment', 'voyagerRoute', { route: { from: '1977-08-20', to: '1979-03-05', view: 'launch' } }),
  chapter('jupiter', 'voyagerRoute', { route: { from: '1979-01-15', to: '1979-08-01', view: 'jupiter' } }, { photo: voyagerPhoto('PIA01384', TEXT.captions.jupiter) }),
  chapter('saturn', 'voyagerRoute', { route: { from: '1980-08-01', to: '1981-09-15', view: 'saturn' } }, { photo: voyagerPhoto('PIA01383', TEXT.captions.saturn) }),
  chapter('ice-giants', 'voyagerRoute', { route: { from: '1981-09-15', to: '1989-10-01', view: 'outer', probes: ['voyager2'] } }, { photo: voyagerPhoto('PIA01492', TEXT.captions.neptune) }),
  // The camera is Voyager 1, looking back: it shows neither itself nor its own path.
  chapter('pale-blue-dot', 'voyagerRoute', { route: { from: '1990-02-14', to: '1990-02-14', view: 'paleBlueDot', probes: [] } }, {
    photo: voyagerPhoto('PIA23645', TEXT.captions.paleBlueDot, 'NASA/JPL-Caltech'),
  }),
  chapter('interstellar', 'voyagerRoute', { route: { from: '1990-02-14', to: '2026-11-15', view: 'heliosphere' } }),
]

export const VOYAGER_LESSON: Lesson = {
  id: 'voyager',
  title: TEXT.title,
  chapters: CHAPTERS,
  markerLatitudeDegrees: 0, // unused by Voyager chapters - see lessonTypes.ts's doc comment
  note: TEXT.note,
}
