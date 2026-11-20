import type { Viewpoint } from '../../camera/viewpoint'
import { formatNumber, locale, msg } from '../../i18n/i18n'
import { LOCALE_TAGS } from '../../i18n/locale'
import type { Chapter } from '../lessonTypes'
import type { ModelScene } from '../../spacecraft/modelScene'
import type { RecordScene } from './recordScene'
import { dateOfDay, type RouteScene } from './routeScene'
import type { VoyagerLabels } from './voyagerLabels'
import type { RecordFeature, VoyagerPart } from './voyagerStage'

const KM_PER_AU = 149597870.7
// Light needs about 499 seconds per AU.
const LIGHT_HOURS_PER_AU = 499.005 / 3600

interface Scenes {
  probe: ModelScene<VoyagerPart>
  record: RecordScene
  route: RouteScene
}

// Places the chapter's labels: the probe's parts, the cover's engravings while the cover faces the
// camera, or the probes (and the heliopause) along the route with the date and their distances.
export function placeVoyagerLabels(labels: VoyagerLabels, scenes: Scenes, chapter: Chapter, viewpoint: Viewpoint): void {
  const stage = chapter.voyager ?? {}
  labels.begin()
  if (chapter.kind === 'voyagerProbe') placePartLabels(labels, stage.labels ?? [], scenes.probe, viewpoint)
  else if (chapter.kind === 'voyagerRecord') placeFeatureLabels(labels, stage.features ?? [], scenes.record, viewpoint)
  else placeRouteLabels(labels, scenes.route, viewpoint)
  labels.finish()
  if (chapter.kind !== 'voyagerRoute') labels.hideClock()
}

function placePartLabels(labels: VoyagerLabels, parts: VoyagerPart[], probe: ModelScene<VoyagerPart>, viewpoint: Viewpoint): void {
  for (const part of parts) labels.place(`part-${part}`, { text: msg.voyager.parts[part], point: probe.anchor(part) }, viewpoint)
}

// Only while the cover faces the camera.
function placeFeatureLabels(labels: VoyagerLabels, features: RecordFeature[], record: RecordScene, viewpoint: Viewpoint): void {
  if (!record.coverShowing) return
  for (const feature of features) labels.place(`feature-${feature}`, { text: msg.voyager.features[feature], point: record.anchor(feature) }, viewpoint)
}

function placeRouteLabels(labels: VoyagerLabels, route: RouteScene, viewpoint: Viewpoint): void {
  const text = msg.voyager
  for (const probe of route.probes) labels.place(`probe-${probe}`, { text: text.probes[probe], point: route.probePosition(probe), variant: 'probe' }, viewpoint)
  if (route.showsHeliopause) {
    labels.place('heliopause', { text: text.heliopause, point: route.boundaries.labelPoint('heliopause'), variant: 'region' }, viewpoint)
    labels.place('terminationShock', { text: text.terminationShock, point: route.boundaries.labelPoint('terminationShock'), variant: 'region' }, viewpoint)
  }
  const date = dateOfDay(route.day).toLocaleDateString(LOCALE_TAGS[locale], { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
  const distances = route.probes.map((probe) => {
    const au = route.probeAu(probe).distanceAu
    return text.distance(text.probes[probe], formatNumber(au, 1), formatNumber((au * KM_PER_AU) / 1e9, 2), formatNumber(au * LIGHT_HOURS_PER_AU, 1))
  })
  labels.showClock([date, ...distances])
}
