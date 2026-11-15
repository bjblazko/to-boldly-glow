import { msg } from '../i18n/i18n'
import { renderChapterChart } from './charts/voyagerCharts'
import { SignalDemo } from './voyager/signalDemo'
import type { Chapter, ChapterLink, ChapterPhoto } from './lessonTypes'

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

// What a chapter shows under its text besides facts: a photo with its credit, a chart of real data,
// links to other websites. Photos and charts come with the app, and say so; a link is the only way
// out of it, and says that too - it opens in a new tab and sends no referrer.
export class LessonMedia {
  // Counts the chapters shown, so a chart that finishes loading after the learner moved on is dropped.
  private shown = 0
  private demo: SignalDemo | null = null

  constructor(private readonly container: HTMLElement) {}

  show(chapter: Pick<Chapter, 'photo' | 'chart' | 'links' | 'demo'>): void {
    const shown = ++this.shown
    this.demo?.dispose()
    this.demo = chapter.demo ? new SignalDemo() : null
    const parts = [...(this.demo ? [this.demo.element] : []), ...staticParts(chapter)]
    this.container.replaceChildren(...parts)
    this.container.hidden = parts.length === 0 && !chapter.chart
    if (!chapter.chart) return
    renderChapterChart(chapter.chart)
      .then((chart) => {
        if (shown === this.shown) this.container.prepend(chart)
      })
      .catch((error: unknown) => console.warn('A lesson chart could not load its data.', error))
  }
}

// The photo and the links: everything but the demo and the chart.
function staticParts(chapter: Pick<Chapter, 'photo' | 'links'>): HTMLElement[] {
  const parts: HTMLElement[] = []
  if (chapter.photo) parts.push(photo(chapter.photo))
  if (chapter.links?.length) parts.push(links(chapter.links))
  return parts
}

function photo({ src, caption, credit }: ChapterPhoto): HTMLElement {
  const figure = Object.assign(document.createElement('figure'), { className: 'hud-lesson-photo' })
  const image = Object.assign(document.createElement('img'), { src, alt: caption, loading: 'lazy', decoding: 'async' })
  const text = Object.assign(document.createElement('figcaption'), { textContent: caption })
  const creditLine = Object.assign(document.createElement('span'), { className: 'hud-lesson-media-credit', textContent: `${msg.voyager.photoCredit(credit)} · ${msg.voyager.bundledNote}` })
  text.append(creditLine)
  figure.append(image, text)
  return figure
}

function links(entries: ChapterLink[]): HTMLElement {
  const list = Object.assign(document.createElement('ul'), { className: 'hud-lesson-links' })
  for (const { label, url } of entries) {
    const anchor = Object.assign(document.createElement('a'), { href: url, target: '_blank', rel: 'noopener noreferrer', referrerPolicy: 'no-referrer' })
    anchor.append(externalIcon(), Object.assign(document.createElement('span'), { textContent: label }))
    const note = Object.assign(document.createElement('span'), { className: 'hud-lesson-link-note', textContent: msg.voyager.externalLink })
    const item = document.createElement('li')
    item.append(anchor, note)
    list.append(item)
  }
  return list
}

function externalIcon(): SVGSVGElement {
  const icon = document.createElementNS(SVG_NAMESPACE, 'svg')
  icon.setAttribute('class', 'icon')
  icon.setAttribute('aria-hidden', 'true')
  const use = document.createElementNS(SVG_NAMESPACE, 'use')
  use.setAttribute('href', '#icon-external')
  icon.append(use)
  return icon
}
