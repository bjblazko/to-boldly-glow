import { afterEach, describe, expect, it, vi } from 'vitest'
import { VoyagerLabels } from '../src/learn/voyager/voyagerLabels'

// A stand-in for the clock's element: what it shows is its children's text.
function fakeClock() {
  const clock = { hidden: true, dataset: {} as Record<string, string>, shown: [] as string[], replaceChildren: (...spans: { textContent: string }[]) => (clock.shown = spans.map((span) => span.textContent)) }
  return clock
}

describe('the route clock, shared by the Voyager and Apollo 11 lessons', () => {
  afterEach(() => vi.unstubAllGlobals())

  it("shows a lesson's lines again after the other lesson wrote its own", () => {
    vi.stubGlobal('document', { createElement: () => ({ textContent: '' }) })
    const clock = fakeClock()
    const element = clock as unknown as HTMLElement
    const voyager = new VoyagerLabels(element, element)
    const apollo = new VoyagerLabels(element, element)
    voyager.showClock(['5 September 1977'])
    apollo.showClock(['16 July 1969'])
    voyager.showClock(['5 September 1977'])
    expect(clock.shown).toEqual(['5 September 1977'])
  })
})
