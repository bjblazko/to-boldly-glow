import type { LessonProgress } from './lessonProgress'
import type { Lesson } from './lessonTypes'
import type { LessonTopic } from './lessons/lessonCatalog'

export interface LessonLibraryElements {
  dialog: HTMLElement
  topics: HTMLElement
  search: HTMLInputElement
  closeButton: HTMLButtonElement
}

// The lesson library: every lesson as a card on its topic's shelf, with how many chapters it has
// and where the learner left off, narrowed down by the search box (titles and chapter titles).
export class LessonLibrary {
  constructor(
    private readonly elements: LessonLibraryElements,
    private readonly shelves: readonly LessonTopic[],
    private readonly progress: LessonProgress,
    private readonly handlers: { onPick(lesson: Lesson): void; onClose(): void },
  ) {
    elements.search.addEventListener('input', () => this.render())
    elements.closeButton.addEventListener('click', () => handlers.onClose())
  }

  get isOpen(): boolean {
    return !this.elements.dialog.hidden
  }

  open(): void {
    this.elements.search.value = ''
    this.render()
    this.elements.dialog.hidden = false
    if (window.matchMedia('(pointer: fine)').matches) this.elements.search.focus()
  }

  close(): void {
    this.elements.dialog.hidden = true
  }

  private render(): void {
    const query = this.elements.search.value.trim().toLowerCase()
    const shelves = this.shelves
      .map((topic) => ({ title: topic.title, lessons: topic.lessons.filter((lesson) => matches(lesson, query)) }))
      .filter((topic) => topic.lessons.length > 0)
      .map((topic) => this.renderShelf(topic))
    if (shelves.length === 0) shelves.push(Object.assign(document.createElement('p'), { className: 'hud-library-empty', textContent: 'No lesson matches' }))
    this.elements.topics.replaceChildren(...shelves)
  }

  private renderShelf(topic: LessonTopic): HTMLElement {
    const shelf = document.createElement('section')
    shelf.className = 'hud-library-shelf'
    const heading = Object.assign(document.createElement('h3'), { className: 'hud-group-title', textContent: topic.title })
    const cards = document.createElement('div')
    cards.className = 'hud-library-cards'
    cards.append(...topic.lessons.map((lesson) => this.renderCard(lesson)))
    shelf.append(heading, cards)
    return shelf
  }

  private renderCard(lesson: Lesson): HTMLButtonElement {
    const card = document.createElement('button')
    card.type = 'button'
    card.className = 'hud-lesson-card'
    card.dataset.lessonId = lesson.id
    const status = this.progress.status(lesson)
    const meta = [`${lesson.chapters.length} chapters`, status].filter(Boolean).join(' · ')
    card.append(
      Object.assign(document.createElement('span'), { className: 'hud-lesson-card-title', textContent: lesson.title }),
      Object.assign(document.createElement('span'), { className: 'hud-lesson-card-meta', textContent: meta }),
    )
    if (status === 'Done') card.classList.add('is-done')
    card.addEventListener('click', () => this.handlers.onPick(lesson))
    return card
  }
}

function matches(lesson: Lesson, query: string): boolean {
  if (!query) return true
  return [lesson.title, ...lesson.chapters.map((chapter) => chapter.title)].some((text) => text.toLowerCase().includes(query))
}
