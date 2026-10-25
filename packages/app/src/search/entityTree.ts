import type { MoonDefinition } from '../solarSystem/moons'
import { matchesSearchQuery, type EntityKind, type SolarSystemEntity } from '../solarSystem/entities'
import { msg } from '../i18n/i18n'

// One row of the object tree: a body, and the moons listed under it.
export interface EntityTreeNode {
  entity: SolarSystemEntity
  children: EntityTreeNode[]
}

// A category of the tree (Planets, Comets, ...), in the order the finder shows them.
export interface EntityTreeGroup {
  id: string
  label: string
  nodes: EntityTreeNode[]
}

const GROUP_NAMES = msg.ui.find.groups
const GROUPS: { id: string; label: string; kind: EntityKind }[] = [
  { id: 'sun', label: GROUP_NAMES.sun, kind: 'sun' },
  { id: 'planets', label: GROUP_NAMES.planets, kind: 'planet' },
  { id: 'dwarfPlanets', label: GROUP_NAMES.dwarfPlanets, kind: 'dwarfPlanet' },
  { id: 'asteroids', label: GROUP_NAMES.asteroids, kind: 'asteroid' },
  { id: 'comets', label: GROUP_NAMES.comets, kind: 'comet' },
]

// Groups the bodies by kind and hangs each moon under its planet. Moons never form a group of
// their own: they are found under their planet (and by searching).
export function buildEntityTree(entities: readonly SolarSystemEntity[]): EntityTreeGroup[] {
  const moonsOf = (parentId: string) =>
    entities.filter((entity) => entity.kind === 'moon' && (entity.definition as MoonDefinition).parentId === parentId)
  const node = (entity: SolarSystemEntity): EntityTreeNode => ({ entity, children: moonsOf(entity.id).map(node) })
  return GROUPS.map(({ id, label, kind }) => ({ id, label, nodes: entities.filter((entity) => entity.kind === kind).map(node) }))
}

// Keeps the bodies whose name matches, and the planet of every matching moon (so a moon is always
// shown in context, under its planet). A planet that matches keeps all its moons. Empty groups go.
export function filterEntityTree(groups: readonly EntityTreeGroup[], query: string): EntityTreeGroup[] {
  if (!query.trim()) return [...groups]
  return groups.map((group) => ({ ...group, nodes: filterNodes(group.nodes, query) })).filter((group) => group.nodes.length > 0)
}

function filterNodes(nodes: readonly EntityTreeNode[], query: string): EntityTreeNode[] {
  return nodes.flatMap((node) => {
    if (matchesSearchQuery(node.entity.name, query)) return [node]
    const children = filterNodes(node.children, query)
    return children.length > 0 ? [{ ...node, children }] : []
  })
}

// The first body that matches, in the order the tree lists them (what Enter picks).
export function firstMatch(groups: readonly EntityTreeGroup[], query: string): SolarSystemEntity | null {
  for (const group of groups) {
    const found = firstMatchingNode(group.nodes, query)
    if (found) return found
  }
  return null
}

function firstMatchingNode(nodes: readonly EntityTreeNode[], query: string): SolarSystemEntity | null {
  for (const node of nodes) {
    if (matchesSearchQuery(node.entity.name, query)) return node.entity
    const child = firstMatchingNode(node.children, query)
    if (child) return child
  }
  return null
}
