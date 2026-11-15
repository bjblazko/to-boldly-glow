import { msg } from '../../i18n/i18n'
import type { Chapter, Lesson } from '../lessonTypes'
import type { VoyagerStage } from '../voyager/voyagerStage'
import { voyagerFact, voyagerPhoto } from './voyager'

const TEXT = msg.lessons.voyagerDeepDive
const CAPTIONS = msg.lessons.voyager.captions

function chapter(id: keyof typeof TEXT.chapters, kind: Chapter['kind'], voyager: VoyagerStage, extra: Partial<Chapter> = {}): Chapter {
  return { id, ...TEXT.chapters[id], kind, voyager, seasonPhaseDegrees: 0, ...extra }
}

const ALL_PARTS: VoyagerStage['labels'] = ['dish', 'bus', 'science', 'rtg', 'magnetometer', 'record']

const CHAPTERS: Chapter[] = [
  chapter('taken-apart', 'voyagerProbe', { explode: 1, labels: ALL_PARTS }),
  chapter('power', 'voyagerProbe', { explode: 1, highlight: 'rtg', labels: ['rtg'] }, {
    facts: [voyagerFact('power', 'power'), voyagerFact('powerLoss', 'power'), voyagerFact('halfLife', 'clock')],
  }),
  chapter('communication', 'voyagerProbe', { explode: 1, highlight: 'dish', labels: ['dish'] }, {
    facts: [voyagerFact('transmitter', 'signal'), voyagerFact('dataRate', 'signal'), voyagerFact('signalTime', 'clock')],
  }),
  chapter('instruments', 'voyagerProbe', { explode: 1, highlight: 'science', labels: ['science', 'magnetometer'] }),
  chapter('gravity-assist', 'voyagerRoute', { route: { from: '1977-08-20', to: '1989-12-31', view: 'outer', probes: ['voyager2'] } }, { chart: 'gravityAssist' }),
  chapter('out-of-plane', 'voyagerRoute', { route: { from: '1977-08-20', to: '2026-11-15', view: 'side' } }, { photo: voyagerPhoto('PIA02246', CAPTIONS.triton) }),
  chapter('heliopause', 'voyagerRoute', { route: { from: '2004-12-16', to: '2012-08-25', view: 'heliosphere', probes: ['voyager1'] } }, { chart: 'heliopauseVoyager1' }),
  chapter('reading-cover', 'voyagerRecord', { side: 'cover', features: ['playing', 'stylus', 'signal', 'firstImage', 'pulsarMap', 'hydrogen'] }, {
    facts: [voyagerFact('turn', 'rotation'), voyagerFact('pulsars', 'sun-distance'), voyagerFact('uranium', 'clock')],
  }),
  chapter('picture-in-sound', 'voyagerRecord', { side: 'label', spinning: true }, { demo: 'pictureSignal' }),
  chapter('still-talking', 'voyagerRoute', { route: { from: '2018-11-05', to: '2026-11-15', view: 'heliosphere' } }),
]

export const VOYAGER_DEEP_DIVE_LESSON: Lesson = {
  id: 'voyagerDeepDive',
  title: TEXT.title,
  chapters: CHAPTERS,
  markerLatitudeDegrees: 0, // unused by Voyager chapters - see lessonTypes.ts's doc comment
  note: TEXT.note,
}
