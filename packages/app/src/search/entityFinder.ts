import { ALL_ENTITIES, type SolarSystemEntity } from '../solarSystem/entities'
import { buildEntityTree, filterEntityTree, firstMatch, type EntityTreeGroup, type EntityTreeNode } from './entityTree'

export interface EntityFinderElements {
  input: HTMLInputElement
  tree: HTMLElement
  followIndicator: HTMLElement
  followLabel: HTMLElement
  stopButton: HTMLButtonElement
}

export interface EntityFinderHandlers {
  onSelect(entity: SolarSystemEntity): void
  onStop(): void
}

// Groups open while nothing is typed; the user's own opening and closing is remembered.
const OPEN_BY_DEFAULT = new Set(['planets'])

// The Find panel: every body in a tree by kind (moons under their planets) that narrows down as
// you type - Enter flies to the first match - and the "Following: X ×" chip, which reflects the
// camera's follow state (set via setFollowing once a fly-to has actually started).
export class EntityFinder {
  private readonly groups = buildEntityTree(ALL_ENTITIES)
  private readonly openGroups = new Set(OPEN_BY_DEFAULT)
  private enabled = true
  private followingId: string | null = null

  constructor(
    private readonly elements: EntityFinderElements,
    private readonly handlers: EntityFinderHandlers,
  ) {
    elements.input.addEventListener('input', () => {
      if (this.enabled) this.render()
    })
    elements.input.addEventListener('keydown', this.onKeyDown)
    elements.stopButton.addEventListener('click', () => this.handlers.onStop())
    this.render()
  }

  private get query(): string {
    return this.elements.input.value
  }

  setFollowing(entity: SolarSystemEntity | null): void {
    if (entity) this.elements.followLabel.textContent = `Following: ${entity.name}`
    this.elements.followIndicator.hidden = !entity
    this.followingId = entity?.id ?? null
    this.render()
  }

  // Lessons switch the finder off outright (not just out of sight), so no stray Enter can start a
  // fly-to that would fight the lesson's camera.
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    this.elements.input.disabled = !enabled
    if (!enabled) {
      this.elements.input.blur()
      this.elements.input.value = ''
      this.render()
    }
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (!this.enabled) return
    if (event.key === 'Escape' && this.query) {
      event.stopPropagation()
      this.elements.input.value = ''
      this.render()
    }
    if (event.key !== 'Enter') return
    const entity = firstMatch(this.groups, this.query)
    if (this.query.trim() && entity) this.choose(entity)
  }

  private choose(entity: SolarSystemEntity): void {
    if (!this.enabled) return
    this.handlers.onSelect(entity)
    this.elements.input.value = ''
    this.render()
  }

  private render(): void {
    const groups = filterEntityTree(this.groups, this.query)
    const filtering = this.query.trim() !== ''
    const content = groups.map((group) => this.renderGroup(group, filtering))
    if (content.length === 0) content.push(Object.assign(document.createElement('p'), { className: 'hud-tree-empty', textContent: 'Nothing found' }))
    this.elements.tree.replaceChildren(...content)
  }

  // A one-body group (the Sun) is a single row; the others fold open and shut.
  private renderGroup(group: EntityTreeGroup, filtering: boolean): HTMLElement {
    if (group.nodes.length === 1 && group.nodes[0].children.length === 0 && group.nodes[0].entity.name === group.label) {
      return this.renderList(group.nodes)
    }
    const details = document.createElement('details')
    details.className = 'hud-tree-group'
    details.dataset.group = group.id
    details.open = filtering || this.openGroups.has(group.id)
    const summary = document.createElement('summary')
    summary.className = 'hud-tree-summary'
    summary.append(group.label, Object.assign(document.createElement('span'), { className: 'hud-tree-count', textContent: String(group.nodes.length) }))
    details.append(summary, this.renderList(group.nodes))
    details.addEventListener('toggle', () => {
      if (filtering) return
      if (details.open) this.openGroups.add(group.id)
      else this.openGroups.delete(group.id)
    })
    return details
  }

  private renderList(nodes: readonly EntityTreeNode[]): HTMLElement {
    const list = document.createElement('ul')
    list.className = 'hud-tree-list'
    for (const node of nodes) {
      const item = document.createElement('li')
      item.append(this.renderRow(node.entity))
      if (node.children.length > 0) item.append(this.renderList(node.children))
      list.append(item)
    }
    return list
  }

  private renderRow(entity: SolarSystemEntity): HTMLButtonElement {
    const row = document.createElement('button')
    row.type = 'button'
    row.className = 'hud-tree-item'
    row.dataset.entityId = entity.id
    const name = document.createElement('span')
    name.append(...highlighted(entity.name, this.query))
    row.append(name)
    if (entity.id === this.followingId) row.setAttribute('aria-current', 'true')
    row.addEventListener('click', () => this.choose(entity))
    return row
  }
}

// The name with the typed part marked.
function highlighted(name: string, query: string): (string | HTMLElement)[] {
  const at = query.trim() ? name.toLowerCase().indexOf(query.trim().toLowerCase()) : -1
  if (at < 0) return [name]
  const end = at + query.trim().length
  return [name.slice(0, at), Object.assign(document.createElement('mark'), { textContent: name.slice(at, end) }), name.slice(end)]
}
