import type { LessonSorting } from './lessonTypes'
import { MenuPopover } from './menuPopover'

export interface SortMenuElements {
  button: HTMLButtonElement
  menu: HTMLElement
  list: HTMLElement
}

// The lesson dock's Sort button and its list of the orders the lesson's chapters can be in (see
// Lesson.sortings); only lessons that have some show the button.
export class LessonSortMenu {
  private readonly popover: MenuPopover
  // Set by whoever runs the lesson: an order picked from the list.
  onPicked: (sortingId: string) => void = () => {}

  constructor(private readonly el: SortMenuElements) {
    this.popover = new MenuPopover(el.menu, el.button)
  }

  set visible(visible: boolean) {
    if (!visible) this.popover.setOpen(false)
  }

  show(sortings: LessonSorting[] | undefined, currentId: string | undefined): void {
    this.el.button.hidden = !sortings
    if (!sortings) this.popover.setOpen(false)
    this.el.list.replaceChildren(...(sortings ?? []).map((sorting) => this.renderItem(sorting, sorting.id === currentId)))
  }

  private renderItem(sorting: LessonSorting, current: boolean): HTMLLIElement {
    const button = Object.assign(document.createElement('button'), { type: 'button', className: 'hud-chapter-item hud-sort-item' })
    button.setAttribute('aria-pressed', String(current))
    button.dataset.sortingId = sorting.id
    button.append(Object.assign(document.createElement('span'), { className: 'hud-sort-name', textContent: sorting.name }))
    if (sorting.hint) button.append(Object.assign(document.createElement('span'), { className: 'hud-sort-hint', textContent: sorting.hint }))
    button.addEventListener('click', () => {
      this.popover.setOpen(false)
      this.onPicked(sorting.id)
    })
    const item = document.createElement('li')
    item.append(button)
    return item
  }
}
