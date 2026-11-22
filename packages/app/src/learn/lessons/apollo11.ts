import { msg } from '../../i18n/i18n'
import { RENDEZVOUS, UNDOCKING } from '../apolloRoute/routeGeometry'
import type { ApolloRouteStage } from '../apolloRoute/routeStage'
import type { CloseupId } from '../apolloRoute/closeupChoreography'
import type { Chapter, ChapterFact, ChapterPhoto, Lesson } from '../lessonTypes'

const TEXT = msg.lessons.apollo11

function chapter(id: keyof typeof TEXT.chapters, stage: ApolloRouteStage, extra: Partial<Chapter> = {}): Chapter {
  return { id, ...TEXT.chapters[id], kind: 'apolloRoute', apolloRoute: stage, seasonPhaseDegrees: 0, ...extra }
}

function facts(...entries: [keyof typeof TEXT.facts, ChapterFact['icon']][]): ChapterFact[] {
  return entries.map(([id, icon]) => ({ icon, ...TEXT.facts[id] }))
}

// Photos bundled with the app (the vehicle lessons' and packages/data-pipeline/src/fetchApollo11Photos.ts).
function photo(nasaId: string, caption: keyof typeof TEXT.captions, credit: string): ChapterPhoto {
  return { src: `images/apollo/${nasaId}.jpg`, caption: TEXT.captions[caption], credit }
}

// Columbia goes half a turn round the Moon while Eagle goes down, and half a turn while it comes up.
const HALF_TURN = 0.125

// The moments the route can only name, played close up with the vehicles (the craft held where it
// is on the route).
function closeup(id: keyof typeof TEXT.chapters, play: { closeup: CloseupId; at: number; event: string }, extra: Partial<Chapter> = {}): Chapter {
  return chapter(id, { view: 'closeup', closeup: play.closeup, from: play.at, to: play.at, event: play.event }, extra)
}

const DOCKING = 2.08
const LANDED = UNDOCKING + HALF_TURN
const LIFTOFF = RENDEZVOUS - HALF_TURN
const ENTRY = 4.88

const CHAPTERS: Chapter[] = [
  chapter('launch', { view: 'earth', from: 0, to: 1, event: 'liftoff' }, { photo: photo('6901000', 'launch', 'NASA/MSFC'), facts: facts(['liftoff', 'clock'], ['inOrbit', 'orbit']) }),
  chapter('parking', { view: 'earth', from: 1, to: 2, event: 'earthOrbitInsertion' }, { facts: facts(['period', 'rotation']) }),
  chapter('tli', { view: 'earth', from: 2, to: 2.06, burn: 'tli', event: 'tliIgnition' }, { facts: facts(['tliBurn', 'clock'], ['tliSpeed', 'power']) }),
  closeup('dock', { closeup: 'transposition', at: DOCKING, event: 'docking' }, { photo: photo('6902077', 'transposition', 'NASA/MSFC') }),
  chapter('coast', { view: 'whole', from: DOCKING, to: 2.97, freeReturn: true, event: 'midcourseCorrection' }, { facts: facts(['coast', 'clock'], ['correction', 'orbit']) }),
  chapter('loi', { view: 'moon', from: 2.97, to: UNDOCKING, burn: 'loi', event: 'loiIgnition' }, { facts: facts(['loiBurn', 'clock'], ['loiBrake', 'power'], ['orbitHeight', 'orbit']) }),
  closeup('undocking', { closeup: 'undocking', at: UNDOCKING, event: 'undocking' }, { photo: photo('as11-44-6581', 'orbit', 'NASA/JSC') }),
  chapter('descent', { view: 'moon', from: UNDOCKING, to: LANDED, eagle: { from: 0, to: 1 }, event: 'poweredDescent' }, { facts: facts(['descentTime', 'clock']) }),
  closeup('landing', { closeup: 'landing', at: LANDED, event: 'landing' }, { photo: photo('as11-37-5458', 'window', 'NASA/JSC'), facts: facts(['landing', 'clock']) }),
  chapter('surface', { view: 'moon', from: LANDED, to: LIFTOFF, eagle: { from: 1, to: 1 }, event: 'firstStep' }, { photo: photo('as11-40-5927', 'surface', 'NASA/JSC'), facts: facts(['firstStep', 'clock'], ['onMoon', 'rotation']) }),
  closeup('liftoff', { closeup: 'liftoff', at: LIFTOFF, event: 'lunarLiftoff' }, { photo: photo('6902073', 'ascentSketch', 'NASA/MSFC') }),
  chapter('ascent', { view: 'moon', from: LIFTOFF, to: RENDEZVOUS, eagle: { from: 1, to: 2 }, event: 'rendezvousDocking' }, { photo: photo('as11-44-6626', 'ascentStage', 'NASA/JSC') }),
  closeup('rendezvous', { closeup: 'rendezvous', at: RENDEZVOUS, event: 'rendezvousDocking' }, { photo: photo('as11-44-6642', 'rendezvous', 'NASA/JSC') }),
  chapter('home', { view: 'whole', from: RENDEZVOUS, to: ENTRY, burn: 'tei', event: 'teiIgnition' }, { facts: facts(['teiBurn', 'clock']) }),
  closeup('entry', { closeup: 'entry', at: ENTRY, event: 'cmSmSeparation' }),
  chapter('splashdown', { view: 'earth', from: ENTRY, to: 5, event: 'splashdown' }, { photo: photo('372772main_GPN-2000-001212_full', 'splashdown', 'NASA'), facts: facts(['entrySpeed', 'power'], ['duration', 'clock']) }),
]

export const APOLLO11_LESSON: Lesson = {
  id: 'apollo11',
  title: TEXT.title,
  chapters: CHAPTERS,
  markerLatitudeDegrees: 0, // unused by these chapters - see lessonTypes.ts's doc comment
  note: TEXT.note,
}
