import { describe, expect, it } from 'vitest'
import { barContext, BarContextView } from '../src/hud/barContext'

describe('barContext', () => {
  it('is explore when nothing runs', () => {
    expect(barContext({ lesson: false, mission: false, tour: false })).toBe('explore')
  })

  it('a lesson wins over a mission tour, which wins over the grand tour', () => {
    expect(barContext({ lesson: true, mission: true, tour: true })).toBe('lesson')
    expect(barContext({ lesson: false, mission: true, tour: true })).toBe('mission')
    expect(barContext({ lesson: false, mission: false, tour: true })).toBe('tour')
  })
})

describe('BarContextView', () => {
  it('writes the context onto the body as parts start and end', () => {
    const body = { dataset: {} } as HTMLElement
    const view = new BarContextView(body)
    expect(body.dataset.context).toBe('explore')
    view.set('mission', true)
    expect(body.dataset.context).toBe('mission')
    view.set('lesson', true)
    expect(view.current).toBe('lesson')
    view.set('lesson', false)
    view.set('mission', false)
    expect(body.dataset.context).toBe('explore')
  })

  it('tells its listeners each change of context, and the current one when they start listening', () => {
    const view = new BarContextView({ dataset: {} } as HTMLElement)
    const heard: string[] = []
    view.onChange((context) => heard.push(context))
    view.set('tour', true)
    view.set('tour', true)
    view.set('tour', false)
    expect(heard).toEqual(['explore', 'tour', 'explore'])
  })
})
