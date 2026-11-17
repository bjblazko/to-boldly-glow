import { describe, expect, it } from 'vitest'
import { filterPaletteItems, type PaletteItem } from '../src/hud/commandPalette'

const item = (group: PaletteItem['group'], label: string): PaletteItem => ({ group, label, detail: '', run: () => {} })
const items = [
  item('Settings', 'Moons'),
  item('Lessons', 'Why does the Moon have phases?'),
  item('Objects', 'Ganymede'),
  item('Objects', 'Moon'),
  item('Objects', 'Mars'),
]

describe('filterPaletteItems', () => {
  it('finds a word anywhere in a label, in group order (objects, lessons, settings)', () => {
    expect(filterPaletteItems(items, 'moon').map((entry) => entry.label)).toEqual(['Moon', 'Why does the Moon have phases?', 'Moons'])
  })

  it('lists names that start with the query first within a group', () => {
    expect(filterPaletteItems(items, 'm').filter((entry) => entry.group === 'Objects').map((entry) => entry.label)).toEqual([
      'Moon',
      'Mars',
      'Ganymede',
    ])
  })

  it('shows a few of each group when nothing is typed', () => {
    const many = Array.from({ length: 20 }, (_, index) => item('Objects', `Body ${index}`))
    expect(filterPaletteItems(many, '')).toHaveLength(6)
  })

  it('puts the tours between the objects and the lessons', () => {
    const withTour = [...items, item('Tours', 'Voyager 1: to the Moon and beyond')]
    expect(filterPaletteItems(withTour, 'moon').map((entry) => entry.group)).toEqual(['Objects', 'Tours', 'Lessons', 'Settings'])
  })

  it('also finds an item by its detail - the moons of a planet by its name - after the label matches', () => {
    const io: PaletteItem = { group: 'Objects', label: 'Io', detail: 'Moon of Jupiter', run: () => {} }
    const jupiter: PaletteItem = { group: 'Objects', label: 'Jupiter', detail: 'Planet', run: () => {} }
    expect(filterPaletteItems([io, jupiter], 'jupiter').map((entry) => entry.label)).toEqual(['Jupiter', 'Io'])
  })
})
