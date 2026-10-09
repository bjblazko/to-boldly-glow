import { describe, expect, it } from 'vitest'
import { ALL_ENTITIES } from '../src/solarSystem/entities'
import { buildEntityTree, filterEntityTree, firstMatch, type EntityTreeGroup } from '../src/search/entityTree'

const tree = buildEntityTree(ALL_ENTITIES)
const names = (groups: EntityTreeGroup[]) =>
  groups.map((group) => [group.id, group.nodes.map((node) => [node.entity.name, node.children.map((child) => child.entity.name)])])

describe('buildEntityTree', () => {
  it('groups the bodies by kind, in the finder order, with no group of moons', () => {
    expect(tree.map((group) => group.id)).toEqual(['sun', 'planets', 'dwarfPlanets', 'asteroids', 'comets'])
    expect(tree.find((group) => group.id === 'planets')?.nodes).toHaveLength(8)
  })

  it('hangs every moon under its planet', () => {
    const planets = tree.find((group) => group.id === 'planets')!.nodes
    const moonsOf = (name: string) => planets.find((node) => node.entity.name === name)!.children.map((child) => child.entity.name)
    expect(moonsOf('Earth')).toEqual(['Moon'])
    expect(moonsOf('Jupiter')).toEqual(['Io', 'Europa', 'Ganymede', 'Callisto'])
    expect(moonsOf('Mercury')).toEqual([])
    const listed = planets.reduce((count, node) => count + node.children.length, 0)
    expect(listed).toBe(ALL_ENTITIES.filter((entity) => entity.kind === 'moon').length)
  })
})

describe('filterEntityTree', () => {
  it('keeps everything for an empty query', () => {
    expect(filterEntityTree(tree, '  ')).toEqual(tree)
  })

  it('keeps a matching moon under its planet, and drops empty groups', () => {
    expect(names(filterEntityTree(tree, 'ti'))).toEqual([
      ['planets', [['Saturn', ['Titan']], ['Uranus', ['Titania']]]],
    ])
  })

  it('keeps all moons of a planet whose own name matches', () => {
    expect(names(filterEntityTree(tree, 'jupi'))).toEqual([['planets', [['Jupiter', ['Io', 'Europa', 'Ganymede', 'Callisto']]]]])
  })

  it('ignores case', () => {
    expect(names(filterEntityTree(tree, 'HALLEY'))).toEqual([['comets', [["Halley's Comet", []]]]])
  })
})

describe('firstMatch', () => {
  it('returns the first matching body in tree order, not a planet kept only as context', () => {
    expect(firstMatch(tree, 'ti')?.name).toBe('Titan')
    expect(firstMatch(tree, 'mars')?.name).toBe('Mars')
    expect(firstMatch(tree, 'nothing like this')).toBeNull()
  })
})
