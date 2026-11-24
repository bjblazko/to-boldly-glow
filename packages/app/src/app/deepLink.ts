import { GRAND_TOUR } from '../camera/tour/grandTour'
import { APOLLO11_STATIONS } from '../missions/apollo11/apollo11Stations'
import { LESSONS_BY_ID } from '../learn/lessons/lessonCatalog'
import type { Lesson } from '../learn/lessonTypes'
import { VOYAGER_MISSIONS } from '../missions/voyagerMissions'
import type { TourId } from '../tours/tourLibrary'
import type { VoyagerProbeId } from '../learn/voyager/voyagerStage'

// Links straight into a lesson or a tour, down to a chapter or a station: `#lesson/<id>/<chapter>`,
// `#tour/<id>/<station>`. The address bar follows along as the lesson or tour moves on, so what it
// shows is always a link to where one is.

export interface DeepLink {
  kind: 'lesson' | 'tour'
  id: string
  // The chapter, station or stop; null: the start (or where the lesson was left).
  part: string | null
}

const NAME = /^[A-Za-z][A-Za-z0-9-]*$/

const named = (value: string | undefined): value is string => value !== undefined && NAME.test(value)

export function parseDeepLink(hash: string): DeepLink | null {
  const [kind, id, part, ...rest] = hash.replace(/^#/, '').split('/')
  const known = (kind === 'lesson' || kind === 'tour') && rest.length === 0 && named(id) && (part === undefined || named(part))
  return known ? { kind, id, part: part ?? null } : null
}

export function formatDeepLink({ kind, id, part }: DeepLink): string {
  return `#${kind}/${id}${part ? `/${part}` : ''}`
}

// What a link opens: a lesson (at a chapter's index in its first order, or null: where it was left),
// or a tour (at a station's or stop's index, or null: from its start); null for an unknown name.
export type DeepLinkTarget = { kind: 'lesson'; lesson: Lesson; chapterIndex: number | null } | { kind: 'tour'; tour: TourId; partIndex: number | null }

export function resolveDeepLink(link: DeepLink): DeepLinkTarget | null {
  return link.kind === 'lesson' ? lessonTarget(link) : tourTarget(link)
}

function lessonTarget(link: DeepLink): DeepLinkTarget | null {
  const lesson = LESSONS_BY_ID[link.id]
  if (!lesson) return null
  const index = (lesson.sortings?.[0]?.chapters ?? lesson.chapters).findIndex((chapter) => chapter.id === link.part)
  return { kind: 'lesson', lesson, chapterIndex: index >= 0 ? index : null }
}

// A tour's stops or stations, by name, in order; null for no such tour.
function tourParts(id: string): string[] | null {
  if (id === 'grand') return GRAND_TOUR.map(({ stop }) => stop)
  if (id === 'apollo11') return APOLLO11_STATIONS.map((station) => station.id)
  return id in VOYAGER_MISSIONS ? VOYAGER_MISSIONS[id as VoyagerProbeId].stations.map((station) => station.id) : null
}

function tourTarget(link: DeepLink): DeepLinkTarget | null {
  const parts = tourParts(link.id)
  if (!parts) return null
  const index = link.part ? parts.indexOf(link.part) : -1
  return { kind: 'tour', tour: link.id as TourId, partIndex: index >= 0 ? index : null }
}
