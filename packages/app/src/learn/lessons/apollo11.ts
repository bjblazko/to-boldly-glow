import { msg } from '../../i18n/i18n'
import { RENDEZVOUS, UNDOCKING } from '../apolloRoute/routeGeometry'
import type { ApolloRouteStage } from '../apolloRoute/routeStage'
import type { Chapter, ChapterFact, ChapterPhoto, Lesson } from '../lessonTypes'

const TEXT = msg.lessons.apollo11

function chapter(id: keyof typeof TEXT.chapters, stage: ApolloRouteStage, extra: Partial<Chapter> = {}): Chapter {
  return { id, ...TEXT.chapters[id], kind: 'apolloRoute', apolloRoute: stage, seasonPhaseDegrees: 0, ...extra }
}

function facts(...entries: [keyof typeof TEXT.facts, ChapterFact['icon']][]): ChapterFact[] {
  return entries.map(([id, icon]) => ({ icon, ...TEXT.facts[id] }))
}

// Photos already bundled for the vehicle lessons.
function photo(nasaId: string, caption: keyof typeof TEXT.captions, credit: string): ChapterPhoto {
  return { src: `images/apollo/${nasaId}.jpg`, caption: TEXT.captions[caption], credit }
}

// Columbia goes half a turn round the Moon while Eagle goes down, and half a turn while it comes up.
const HALF_TURN = 0.125

const CHAPTERS: Chapter[] = [
  chapter('launch', { view: 'earth', from: 0, to: 1, event: 'liftoff' }, { photo: photo('6901000', 'launch', 'NASA/MSFC'), facts: facts(['liftoff', 'clock'], ['inOrbit', 'orbit']) }),
  chapter('parking', { view: 'earth', from: 1, to: 2, event: 'earthOrbitInsertion' }, { facts: facts(['period', 'rotation']) }),
  chapter('tli', { view: 'earth', from: 2, to: 2.06, burn: 'tli', event: 'tliIgnition' }, { facts: facts(['tliBurn', 'clock'], ['tliSpeed', 'power']) }),
  chapter('dock', { view: 'earth', from: 2.06, to: 2.12, event: 'docking' }),
  chapter('coast', { view: 'whole', from: 2.12, to: 2.97, freeReturn: true, event: 'midcourseCorrection' }, { facts: facts(['coast', 'clock'], ['correction', 'orbit']) }),
  chapter('loi', { view: 'moon', from: 2.97, to: UNDOCKING, burn: 'loi', event: 'loiIgnition' }, { facts: facts(['loiBurn', 'clock'], ['loiBrake', 'power'], ['orbitHeight', 'orbit']) }),
  chapter('descent', { view: 'moon', from: UNDOCKING, to: UNDOCKING + HALF_TURN, eagle: { from: 0, to: 1 }, event: 'landing' }, { photo: photo('as11-44-6581', 'orbit', 'NASA/JSC'), facts: facts(['descentTime', 'clock']) }),
  chapter('surface', { view: 'moon', from: UNDOCKING + HALF_TURN, to: RENDEZVOUS - HALF_TURN, eagle: { from: 1, to: 1 }, event: 'firstStep' }, { photo: photo('as11-40-5927', 'surface', 'NASA/JSC'), facts: facts(['landing', 'clock'], ['firstStep', 'clock'], ['onMoon', 'rotation']) }),
  chapter('ascent', { view: 'moon', from: RENDEZVOUS - HALF_TURN, to: RENDEZVOUS, eagle: { from: 1, to: 2 }, event: 'rendezvousDocking' }, { photo: photo('as11-44-6642', 'rendezvous', 'NASA/JSC') }),
  chapter('home', { view: 'whole', from: RENDEZVOUS, to: 4.9, burn: 'tei', event: 'teiIgnition' }, { facts: facts(['teiBurn', 'clock']) }),
  chapter('splashdown', { view: 'earth', from: 4.9, to: 5, event: 'splashdown' }, { photo: photo('372772main_GPN-2000-001212_full', 'splashdown', 'NASA'), facts: facts(['entrySpeed', 'power'], ['duration', 'clock']) }),
]

export const APOLLO11_LESSON: Lesson = {
  id: 'apollo11',
  title: TEXT.title,
  chapters: CHAPTERS,
  markerLatitudeDegrees: 0, // unused by these chapters - see lessonTypes.ts's doc comment
  note: TEXT.note,
}
