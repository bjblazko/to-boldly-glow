export type PaletteGroup = 'Objects' | 'Lessons' | 'Settings'

// One thing the palette can find and do.
export interface PaletteItem {
  group: PaletteGroup
  label: string
  // Shown after the label: an object's kind, a lesson's chapters, a switch's state.
  detail: string
  run(): void
}

const GROUP_ORDER: PaletteGroup[] = ['Objects', 'Lessons', 'Settings']
// With nothing typed, each group shows only its first few items.
const UNFILTERED_PER_GROUP = 6
const FILTERED_PER_GROUP = 12

// The items matching the query, by group, names that start with it first.
export function filterPaletteItems(items: readonly PaletteItem[], query: string): PaletteItem[] {
  const needle = query.trim().toLowerCase()
  const limit = needle ? FILTERED_PER_GROUP : UNFILTERED_PER_GROUP
  return GROUP_ORDER.flatMap((group) => {
    const inGroup = items.filter((item) => item.group === group && item.label.toLowerCase().includes(needle))
    const startsWith = (item: PaletteItem) => (item.label.toLowerCase().startsWith(needle) ? 0 : 1)
    return [...inGroup].sort((a, b) => startsWith(a) - startsWith(b)).slice(0, limit)
  })
}

export interface CommandPaletteElements {
  dialog: HTMLElement
  input: HTMLInputElement
  results: HTMLElement
  openButton: HTMLButtonElement
}

// Search everything (Ctrl+K or Cmd+K, or the top-right search button): one box over the objects,
// the lessons and the settings. Arrow keys move through the results, Enter does the chosen one,
// Escape (or a press outside) closes it. The items are gathered fresh each time it opens, so the
// settings show their current state.
export class CommandPalette {
  private shown: PaletteItem[] = []
  private chosen = 0
  private returnFocus: HTMLElement | null = null

  constructor(
    private readonly elements: CommandPaletteElements,
    private readonly gatherItems: () => PaletteItem[],
  ) {
    elements.openButton.addEventListener('click', () => this.open())
    elements.input.addEventListener('input', () => this.render())
    elements.input.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        if (this.isOpen) this.close()
        else this.open()
      }
    })
    window.addEventListener('pointerdown', (event) => {
      if (this.isOpen && !elements.dialog.contains(event.target as Node | null) && !elements.openButton.contains(event.target as Node | null)) this.close()
    })
  }

  get isOpen(): boolean {
    return !this.elements.dialog.hidden
  }

  open(): void {
    this.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    this.elements.input.value = ''
    this.elements.dialog.hidden = false
    this.render()
    this.elements.input.focus()
  }

  close(): void {
    this.elements.dialog.hidden = true
    this.returnFocus?.focus()
  }

  private onKeyDown = (event: KeyboardEvent) => {
    const moves: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 }
    if (event.key in moves) {
      event.preventDefault()
      this.choose(this.chosen + moves[event.key])
    } else if (event.key === 'Enter') this.run(this.shown[this.chosen])
    else if (event.key === 'Escape') this.close()
  }

  private run(item: PaletteItem | undefined): void {
    if (!item) return
    this.close()
    item.run()
  }

  private choose(index: number): void {
    if (this.shown.length === 0) return
    this.chosen = (index + this.shown.length) % this.shown.length
    this.elements.results.querySelectorAll('[role="option"]').forEach((row, rowIndex) => {
      row.setAttribute('aria-selected', String(rowIndex === this.chosen))
      if (rowIndex === this.chosen) row.scrollIntoView({ block: 'nearest' })
    })
  }

  private render(): void {
    this.shown = filterPaletteItems(this.gatherItems(), this.elements.input.value)
    const rows: HTMLElement[] = []
    this.shown.forEach((item, index) => {
      if (index === 0 || this.shown[index - 1].group !== item.group) rows.push(groupHeading(item.group))
      rows.push(this.renderRow(item, index))
    })
    if (rows.length === 0) rows.push(Object.assign(document.createElement('li'), { className: 'hud-palette-empty', textContent: 'Nothing found' }))
    this.elements.results.replaceChildren(...rows)
    this.choose(0)
  }

  private renderRow(item: PaletteItem, index: number): HTMLElement {
    const row = document.createElement('li')
    row.className = 'hud-palette-item'
    row.setAttribute('role', 'option')
    row.append(item.label, Object.assign(document.createElement('span'), { className: 'hud-palette-detail', textContent: item.detail }))
    row.addEventListener('pointermove', () => {
      if (this.chosen !== index) this.choose(index)
    })
    row.addEventListener('click', () => this.run(item))
    return row
  }
}

function groupHeading(group: PaletteGroup): HTMLElement {
  const heading = Object.assign(document.createElement('li'), { className: 'hud-palette-group', textContent: group })
  heading.setAttribute('role', 'presentation')
  return heading
}
