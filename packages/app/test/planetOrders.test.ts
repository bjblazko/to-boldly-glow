import { describe, expect, it } from 'vitest'
import { PLANET_SIZES_LESSON } from '../src/learn/lessons/planetSizes'
import { orderedPlanetIds, PLANET_ORDERS } from '../src/learn/sizes/planetOrders'

const orderById = (id: string) => PLANET_ORDERS.find((order) => order.id === id)!

describe('the orders the planets can be lined up in', () => {
  it.each([
    ['distance', ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']],
    ['size', ['jupiter', 'saturn', 'uranus', 'neptune', 'earth', 'venus', 'mars', 'mercury']],
    ['mass', ['jupiter', 'saturn', 'neptune', 'uranus', 'earth', 'venus', 'mars', 'mercury']],
    ['type', ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']],
    ['speed', ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']],
    ['day', ['jupiter', 'saturn', 'neptune', 'uranus', 'earth', 'mars', 'venus', 'mercury']],
    ['year', ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']],
    ['temperature', ['venus', 'mercury', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']],
    ['density', ['earth', 'mercury', 'venus', 'mars', 'neptune', 'jupiter', 'uranus', 'saturn']],
    // Mercury and Mars pull alike; a tie keeps the order out from the Sun.
    ['gravity', ['jupiter', 'neptune', 'earth', 'saturn', 'venus', 'uranus', 'mercury', 'mars']],
    ['tilt', ['mercury', 'jupiter', 'earth', 'mars', 'saturn', 'neptune', 'uranus', 'venus']],
  ])('by %s', (id, expected) => {
    expect(orderedPlanetIds(orderById(id))).toEqual(expected)
  })

  it('starts out from the Sun', () => {
    expect(PLANET_ORDERS[0].id).toBe('distance')
    expect(PLANET_SIZES_LESSON.chapters).toBe(PLANET_SIZES_LESSON.sortings![0].chapters)
  })

  it('gives the lesson the same chapters in each order, the whole lineup first', () => {
    const chapterIds = (chapters: { id: string }[]) => chapters.map((chapter) => chapter.id)
    for (const sorting of PLANET_SIZES_LESSON.sortings!) {
      expect(sorting.chapters[0].id, sorting.id).toBe('lineup')
      expect(chapterIds(sorting.chapters).sort(), sorting.id).toEqual(chapterIds(PLANET_SIZES_LESSON.chapters).sort())
    }
  })

  it("notes each planet's value under its name", () => {
    const notes = (id: string) => PLANET_SIZES_LESSON.sortings!.find((sorting) => sorting.id === id)!.planetNotes
    expect(notes('distance').jupiter).toBe('778.6 million km')
    expect(notes('size').earth).toBe('12,742 km')
    expect(notes('mass').mercury).toBe('0.0553 × Earth')
    expect(notes('type').uranus).toBe('Ice giant')
    expect(notes('speed').mercury).toBe('47.4 km/s')
    expect(notes('day').venus).toBe('116.8 days')
    expect(notes('day').earth).toBe('24 hours')
    expect(notes('temperature').neptune).toBe('−200 °C')
    expect(notes('density').saturn).toBe('0.69 g/cm³')
    expect(notes('gravity').jupiter).toBe('2.36 × Earth')
    expect(notes('tilt').uranus).toBe('97.8°')
    for (const sorting of PLANET_SIZES_LESSON.sortings!) expect(Object.keys(sorting.planetNotes), sorting.id).toHaveLength(8)
  })
})
