import type { Viewpoint } from '../../camera/viewpoint'
import { locale, msg } from '../../i18n/i18n'
import { LOCALE_TAGS } from '../../i18n/locale'
import type { Rgba } from '../../math/tuples'
import { APOLLO11_EVENTS, eventUtc } from '../../missions/apollo11/apollo11Events'
import { OverlayLines } from '../seasons/overlayLines'
import type { VoyagerLabels } from '../voyager/voyagerLabels'
import type { ApolloRouteScene } from './apolloRouteScene'
import { eaglePoint, eaglePoints, LANDING_SITE, LEGS, routePoint, routePoints } from './routeGeometry'
import type { ApolloBurn } from './routeStage'

// Points per unit of route progress (a leg), and for Eagle's way down and up.
const POINTS_PER_LEG = 160
const EAGLE_POINTS = 120
const FLOWN: Rgba = [0.4, 0.85, 1, 1]
const AHEAD_DIMMING = 0.3
const EAGLE_COLOR: Rgba = [1, 0.72, 0.35, 1]
const FREE_RETURN: Rgba = [0.99, 0.78, 0.25, 0.8]
// Where each burn happened along the route.
const BURNS: Record<ApolloBurn, number> = { tli: 2, loi: 3, tei: 4 }

type LineId = 'flown' | 'ahead' | 'eagle' | 'freeReturn'
const EMPTY = new Float32Array(0)

// The Apollo 11 lesson's lines and labels: the route flown so far (bright) and still ahead (dim),
// Eagle's own way down and up, the free return, the craft and the burns named, and the chapter's
// moment on the clock.
export class ApolloRouteOverlay {
  private readonly lines: OverlayLines<LineId>

  constructor(device: GPUDevice, linePipeline: GPURenderPipeline) {
    const capacity = POINTS_PER_LEG * LEGS.length + 2
    this.lines = new OverlayLines<LineId>(device, linePipeline, {
      ahead: { capacity, color: [FLOWN[0] * AHEAD_DIMMING, FLOWN[1] * AHEAD_DIMMING, FLOWN[2] * AHEAD_DIMMING, 1], mode: 'solid' },
      flown: { capacity, color: FLOWN, mode: 'solid' },
      eagle: { capacity: EAGLE_POINTS + 2, color: EAGLE_COLOR, mode: 'solid' },
      freeReturn: { capacity: POINTS_PER_LEG + 2, color: FREE_RETURN, mode: 'glow' },
    })
  }

  update(scene: ApolloRouteScene, frame: { viewpoint: Viewpoint; nowSeconds: number }): void {
    const craft = scene.craftProgress
    const eagle = scene.eagleProgress
    this.lines.update(
      {
        flown: stretch(0, craft),
        ahead: stretch(craft, LEGS.length),
        eagle: eagle === null ? EMPTY : eaglePoints(0, eagle, Math.ceil(eagle * (EAGLE_POINTS / 2)) + 2),
        freeReturn: scene.stage?.freeReturn ? stretch(4, 5) : EMPTY,
      },
      frame.viewpoint,
      frame.nowSeconds,
    )
  }

  // Expects the line pipeline to be set on the pass.
  draw(pass: GPURenderPassEncoder): void {
    this.lines.draw(pass)
  }
}

function stretch(from: number, to: number): Float32Array {
  return routePoints(from, to, Math.ceil(Math.abs(to - from) * POINTS_PER_LEG) + 2)
}

// The chapter's labels: the craft (Columbia and Eagle apart while they fly apart), the burn, the
// free return and Tranquility Base where the chapter shows them; and the clock.
export function placeApolloRouteLabels(labels: VoyagerLabels, scene: ApolloRouteScene, viewpoint: Viewpoint): void {
  const text = msg.lessons.apollo11.labels
  const stage = scene.stage
  labels.begin()
  if (stage) {
    const eagle = scene.eagleProgress
    const craft = routePoint(scene.craftProgress)
    labels.place('craft', { text: eagle === null ? text.apollo11 : text.columbia, point: craft, variant: 'probe' }, viewpoint)
    if (eagle !== null) placeEagle(labels, eagle, viewpoint)
    if (stage.burn) labels.place('burn', { text: text.burns[stage.burn], point: routePoint(BURNS[stage.burn]), variant: 'mark' }, viewpoint)
    if (stage.freeReturn) labels.place('freeReturn', { text: text.freeReturn, point: routePoint(4.55), variant: 'region' }, viewpoint)
    labels.showClock(clockLines(stage.event))
  }
  labels.finish()
}

function placeEagle(labels: VoyagerLabels, eagle: number, viewpoint: Viewpoint): void {
  const text = msg.lessons.apollo11.labels
  // Landed, it is Tranquility Base; docked again, Columbia's label names both.
  if (Math.abs(eagle - 1) < 1e-3) labels.place('site', { text: text.tranquilityBase, point: LANDING_SITE, variant: 'probe' }, viewpoint)
  else if (eagle < 2 - 1e-3) labels.place('eagle', { text: text.eagle, point: eaglePoint(eagle), variant: 'probe' }, viewpoint)
}

// The event's date and time (UTC) and its mission time (hours:minutes:seconds after liftoff's
// range zero).
function clockLines(eventId: string): string[] {
  const event = APOLLO11_EVENTS.find((candidate) => candidate.id === eventId)
  if (!event) return []
  const when = new Date(eventUtc(event)).toLocaleString(LOCALE_TAGS[locale], { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' })
  const seconds = Math.floor(event.get)
  const get = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map((value, index) => String(value).padStart(index === 0 ? 3 : 2, '0')).join(':')
  return [`${when} UTC`, msg.lessons.apollo11.labels.missionTime(get)]
}
