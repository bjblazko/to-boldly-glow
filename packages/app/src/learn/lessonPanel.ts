import { makePanelDraggable } from '../hud/draggablePanel'
import type { LessonPlayer } from './lessonPlayer'
import type { ChapterFact } from './lessonTypes'

type Find = <T extends HTMLElement>(selector: string) => T

interface PanelElements {
  panel: HTMLElement
  title: HTMLElement
  text: HTMLElement
  facts: HTMLElement
  note: HTMLElement
  body: HTMLElement
  foldButton: HTMLButtonElement
  count: HTMLElement
  chapterButton: HTMLButtonElement
  chapterMenu: HTMLElement
  chapterList: HTMLElement
}

function findPanelElements(find: Find): PanelElements {
  return {
    panel: find('#lesson-panel'),
    title: find('#lesson-chapter-title'),
    text: find('#lesson-chapter-text'),
    facts: find('#lesson-chapter-facts'),
    note: find('#lesson-note'),
    body: find('#lesson-panel-body'),
    foldButton: find('#lesson-text-toggle'),
    count: find('#lesson-chapter-count'),
    chapterButton: find('#lesson-chapter-btn'),
    chapterMenu: find('#lesson-chapter-menu'),
    chapterList: find('#lesson-chapter-list'),
  }
}

// The lesson's text card (chapter title, text, the chapter's facts as pictograms, and the lesson's
// note on what is and isn't to scale, foldable down to its title) and the lesson dock's chapter
// controls: back, next, and the chapter counter that opens a list of every chapter to jump to.
export class LessonPanel {
  private readonly el: PanelElements
  readonly previousButton: HTMLButtonElement
  readonly nextButton: HTMLButtonElement
  // Set by whoever runs the lesson: a chapter picked from the list.
  onChapterPicked: (index: number) => void = () => {}

  constructor(find: Find) {
    this.el = findPanelElements(find)
    this.previousButton = find('#lesson-prev-chapter')
    this.nextButton = find('#lesson-next-chapter')
    makePanelDraggable(this.el.panel, find('#lesson-panel-grip'))
    this.el.foldButton.addEventListener('click', () => this.setFolded(!this.el.body.hidden))
    this.el.chapterButton.addEventListener('click', () => this.setMenuOpen(Boolean(this.el.chapterMenu.hidden)))
    this.closeMenuOnOutsideActions()
  }

  set visible(visible: boolean) {
    this.el.panel.hidden = !visible
    if (!visible) this.setMenuOpen(false)
  }

  show(player: LessonPlayer): void {
    const { currentChapter: chapter, currentLesson: lesson, currentChapterIndex: index } = player
    this.el.title.textContent = chapter.title
    this.el.count.textContent = `${index + 1} / ${lesson.chapters.length}`
    this.previousButton.disabled = !player.hasPreviousChapter
    this.nextButton.disabled = !player.hasNextChapter
    this.el.text.textContent = chapter.text
    this.renderFacts(chapter.facts ?? [])
    this.el.note.textContent = lesson.note ?? ''
    this.el.note.hidden = !lesson.note
    this.el.panel.dataset.chapterId = chapter.id
    this.el.panel.dataset.chapterKind = chapter.kind
    this.renderChapterList(lesson.chapters.map((entry) => entry.title), index)
  }

  private setFolded(folded: boolean): void {
    this.el.body.hidden = folded
    this.el.panel.classList.toggle('is-folded', folded)
    this.el.foldButton.setAttribute('aria-expanded', String(!folded))
    this.el.foldButton.setAttribute('aria-label', folded ? 'Show the text' : 'Hide the text')
  }

  private setMenuOpen(open: boolean): void {
    this.el.chapterMenu.hidden = !open
    this.el.chapterButton.setAttribute('aria-expanded', String(open))
    this.el.chapterButton.classList.toggle('is-active', open)
    if (open) this.el.chapterList.querySelector<HTMLElement>('[aria-current] button')?.focus()
  }

  private renderFacts(facts: ChapterFact[]): void {
    this.el.facts.replaceChildren(...facts.map(renderFact))
    this.el.facts.hidden = facts.length === 0
  }

  private renderChapterList(titles: string[], current: number): void {
    const items = titles.map((title, index) => {
      const item = document.createElement('li')
      const button = Object.assign(document.createElement('button'), { type: 'button', className: 'hud-chapter-item', textContent: title })
      button.dataset.chapterIndex = String(index)
      button.addEventListener('click', () => {
        this.setMenuOpen(false)
        this.onChapterPicked(index)
      })
      if (index === current) item.setAttribute('aria-current', 'step')
      item.append(button)
      return item
    })
    this.el.chapterList.replaceChildren(...items)
  }

  // The chapter list closes on Escape and on a press anywhere outside it.
  private closeMenuOnOutsideActions(): void {
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !this.el.chapterMenu.hidden) this.setMenuOpen(false)
    })
    window.addEventListener('pointerdown', (event) => {
      const target = event.target as Node | null
      if (this.el.chapterMenu.hidden || this.el.chapterMenu.contains(target) || this.el.chapterButton.contains(target)) return
      this.setMenuOpen(false)
    })
  }
}

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

// A pictogram from index.html's icon sprite, a small label and the value.
function renderFact(fact: ChapterFact): HTMLLIElement {
  const icon = document.createElementNS(SVG_NAMESPACE, 'svg')
  icon.setAttribute('class', 'icon')
  icon.setAttribute('aria-hidden', 'true')
  const use = document.createElementNS(SVG_NAMESPACE, 'use')
  use.setAttribute('href', `#icon-${fact.icon}`)
  icon.append(use)
  const item = Object.assign(document.createElement('li'), { className: 'hud-lesson-fact' })
  item.dataset.factIcon = fact.icon
  item.append(
    icon,
    Object.assign(document.createElement('span'), { className: 'hud-lesson-fact-label', textContent: fact.label }),
    Object.assign(document.createElement('span'), { className: 'hud-lesson-fact-value', textContent: fact.value }),
  )
  return item
}
