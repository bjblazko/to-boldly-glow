import { makePanelDraggable } from '../hud/draggablePanel'
import type { LessonPlayer } from './lessonPlayer'

// The lesson panel: chapter title and text, the lesson's note on what is and isn't to scale, and
// previous/next chapter buttons.
export class LessonPanel {
  private readonly panel: HTMLElement
  private readonly title: HTMLElement
  private readonly text: HTMLElement
  private readonly note: HTMLElement
  readonly previousButton: HTMLButtonElement
  readonly nextButton: HTMLButtonElement

  constructor(find: <T extends HTMLElement>(selector: string) => T) {
    this.panel = find('#lesson-panel')
    this.title = find('#lesson-chapter-title')
    this.text = find('#lesson-chapter-text')
    this.note = find('#lesson-note')
    this.previousButton = find('#lesson-prev-chapter')
    this.nextButton = find('#lesson-next-chapter')
    makePanelDraggable(this.panel, find('#lesson-panel-grip'))
  }

  set visible(visible: boolean) {
    this.panel.hidden = !visible
  }

  show(player: LessonPlayer): void {
    const { currentChapter: chapter, currentLesson: lesson } = player
    const count = document.createElement('span')
    count.className = 'hud-lesson-count'
    count.textContent = `${player.currentChapterIndex + 1} / ${lesson.chapters.length}`
    this.title.replaceChildren(count, ` ${chapter.title}`)
    this.previousButton.disabled = !player.hasPreviousChapter
    this.nextButton.disabled = !player.hasNextChapter
    this.text.textContent = chapter.text
    this.note.textContent = lesson.note ?? ''
    this.note.hidden = !lesson.note
    this.panel.dataset.chapterId = chapter.id
    this.panel.dataset.chapterKind = chapter.kind
  }
}
