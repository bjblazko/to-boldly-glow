import { describe, expect, it } from 'vitest'
import { ApolloRouteScene } from '../src/learn/apolloRoute/apolloRouteScene'
import { ROUTE_EARTH, ROUTE_MOON } from '../src/learn/apolloRoute/routeGeometry'
import { apolloRouteShot } from '../src/learn/apolloRoute/routeShots'
import type { ApolloRouteStage } from '../src/learn/apolloRoute/routeStage'
import { ephemerisAt } from '../src/time/ephemeris'

const COAST: ApolloRouteStage = { view: 'whole', from: 2.1, to: 3, event: 'midcourseCorrection' }
const DESCENT: ApolloRouteStage = { view: 'moon', from: 3.4, to: 3.6, eagle: { from: 0, to: 1 }, event: 'landing' }

describe('the Apollo 11 lesson scene', () => {
  it("plays the craft along the chapter's stretch, then holds at its end", () => {
    const scene = new ApolloRouteScene()
    scene.show(COAST, true)
    expect(scene.craftProgress).toBeCloseTo(2.1, 6)
    scene.update(1)
    expect(scene.craftProgress).toBeGreaterThan(2.1)
    expect(scene.craftProgress).toBeLessThan(3)
    for (let i = 0; i < 60; i++) scene.update(1)
    expect(scene.craftProgress).toBeCloseTo(3, 6)
  })

  it('shows the end at once when not animated (a chapter jumped to, or reduced motion)', () => {
    const scene = new ApolloRouteScene()
    scene.show(DESCENT, false)
    expect(scene.craftProgress).toBeCloseTo(3.6, 6)
    expect(scene.eagleProgress).toBeCloseTo(1, 6)
  })

  it('has no Eagle of its own while it is docked', () => {
    const scene = new ApolloRouteScene()
    scene.show(COAST, false)
    expect(scene.eagleProgress).toBeNull()
  })

  it('stages Earth and the Moon where the route has them, lit by the Sun', () => {
    const scene = new ApolloRouteScene()
    scene.show(COAST, false)
    const layout = scene.layout(ephemerisAt(new Date(Date.UTC(1969, 6, 20))))
    expect([...layout.planets[0].position]).toEqual([...ROUTE_EARTH])
    expect([...layout.moons[0].position]).toEqual([...ROUTE_MOON])
    expect(layout.moons[0].earthshine).toBeGreaterThan(0)
  })

  it('frames each view on its own, flying between them', () => {
    const shot = (view: ApolloRouteStage['view']) => apolloRouteShot({ ...COAST, view })
    expect(new Set([shot('earth').key, shot('whole').key, shot('moon').key]).size).toBe(3)
    expect([...shot('moon').preset.target]).toEqual([...ROUTE_MOON])
    expect([...shot('earth').preset.target]).toEqual([...ROUTE_EARTH])
    expect(shot('whole').bounds.halfWidth).toBeGreaterThan(Math.hypot(ROUTE_MOON[0] - ROUTE_EARTH[0], ROUTE_MOON[1] - ROUTE_EARTH[1]) / 2)
  })
})
