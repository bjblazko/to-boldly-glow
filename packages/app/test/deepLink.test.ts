import { describe, expect, it } from 'vitest'
import { formatDeepLink, parseDeepLink } from '../src/app/deepLink'

describe('deep links', () => {
  it('name a lesson and, if wanted, its chapter', () => {
    expect(parseDeepLink('#lesson/apollo11/landing')).toEqual({ kind: 'lesson', id: 'apollo11', part: 'landing' })
    expect(parseDeepLink('#lesson/apollo11')).toEqual({ kind: 'lesson', id: 'apollo11', part: null })
  })

  it('name a tour and, if wanted, its station or stop', () => {
    expect(parseDeepLink('#tour/voyager1/jupiter')).toEqual({ kind: 'tour', id: 'voyager1', part: 'jupiter' })
    expect(parseDeepLink('#tour/grand')).toEqual({ kind: 'tour', id: 'grand', part: null })
  })

  it('ignore anything else', () => {
    for (const hash of ['', '#', '#about', '#lesson', '#tour/', '#planet/mars', '#lesson/../x']) expect(parseDeepLink(hash), hash).toBeNull()
  })

  it('write what they read', () => {
    for (const link of [{ kind: 'lesson', id: 'saturnV', part: 'sivb' }, { kind: 'tour', id: 'voyager2', part: null }] as const) expect(parseDeepLink(formatDeepLink(link))).toEqual(link)
  })
})

describe('what a deep link opens', () => {
  it('a lesson at the chapter named, in its first order of chapters', async () => {
    const { resolveDeepLink } = await import('../src/app/deepLink')
    const target = resolveDeepLink({ kind: 'lesson', id: 'apollo11', part: 'landing' })
    expect(target?.kind).toBe('lesson')
    if (target?.kind !== 'lesson') return
    expect(target.lesson.id).toBe('apollo11')
    expect((target.lesson.sortings?.[0]?.chapters ?? target.lesson.chapters)[target.chapterIndex!].id).toBe('landing')
  })

  it('a lesson where it was left when no chapter is named, and nothing for an unknown lesson or chapter', async () => {
    const { resolveDeepLink } = await import('../src/app/deepLink')
    expect(resolveDeepLink({ kind: 'lesson', id: 'saturnV', part: null })).toMatchObject({ kind: 'lesson', chapterIndex: null })
    expect(resolveDeepLink({ kind: 'lesson', id: 'noSuchLesson', part: null })).toBeNull()
    expect(resolveDeepLink({ kind: 'lesson', id: 'saturnV', part: 'noSuchChapter' })).toMatchObject({ kind: 'lesson', chapterIndex: null })
  })

  it('a mission tour at its station, the grand tour at its stop', async () => {
    const { resolveDeepLink } = await import('../src/app/deepLink')
    const { VOYAGER_MISSIONS } = await import('../src/missions/voyagerMissions')
    const station = VOYAGER_MISSIONS.voyager1.stations[2].id
    expect(resolveDeepLink({ kind: 'tour', id: 'voyager1', part: station })).toEqual({ kind: 'tour', tour: 'voyager1', partIndex: 2 })
    expect(resolveDeepLink({ kind: 'tour', id: 'grand', part: 'saturn' })).toEqual({ kind: 'tour', tour: 'grand', partIndex: 6 })
    expect(resolveDeepLink({ kind: 'tour', id: 'grand', part: null })).toEqual({ kind: 'tour', tour: 'grand', partIndex: null })
    expect(resolveDeepLink({ kind: 'tour', id: 'apollo13', part: null })).toBeNull()
  })
})
