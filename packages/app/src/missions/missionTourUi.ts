import { msg } from '../i18n/i18n'
import { renderFact } from '../learn/lessonPanel'
import { LessonMedia } from '../learn/lessonMedia'
import type { ChapterChart, ChapterFact, ChapterPhoto } from '../learn/lessonTypes'

type Find = <T extends HTMLElement>(selector: string) => T

export interface MissionTourHandlers {
  togglePause(): void
  previous(): void
  next(): void
  jumpTo(index: number): void
  close(): void
}

// A tour as its panel shows it: a name (the page's data-mission-tour) and its stations, each with
// its title and a short mark on the timeline (a year, a mission time).
export interface TourOutline {
  id: string
  stations: { title: string; mark: string }[]
}

// A station's card.
export interface StationCard {
  title: string
  text: string
  // Its date or mission time, over the title.
  when: string
  // A badge under it (a flyby at true scale), if any.
  badge?: string
  facts?: ChapterFact[]
  photo?: ChapterPhoto
  chart?: ChapterChart
}

// What the panel shows as the tour runs.
export interface TourState {
  stationIndex: number
  fade: number
  paused: boolean
  // On the way to a station whose card is not open yet.
  travelling: boolean
}

interface Elements {
  root: HTMLElement
  fade: HTMLElement
  date: HTMLElement
  flyby: HTMLElement
  title: HTMLElement
  distance: HTMLElement
  text: HTMLElement
  facts: HTMLElement
  timeline: HTMLElement
  play: HTMLButtonElement
}

function findElements(find: Find): Elements {
  return {
    root: find('#mission-tour'),
    fade: find('#mission-fade'),
    date: find('#mission-card-date'),
    flyby: find('#mission-card-flyby'),
    title: find('#mission-card-title'),
    distance: find('#mission-card-distance'),
    text: find('#mission-card-text'),
    facts: find('#mission-card-facts'),
    timeline: find('#mission-timeline'),
    play: find('#mission-play'),
  }
}

// A mission tour on screen: the station's card (date, title, distance, text, facts, a photo or a
// chart - all bundled with the app), the bar's timeline of stations with play/pause and back/next,
// and the fade into and out of a flyby. Escape (or the bar's End tour) leaves it.
export class MissionTourUi {
  private readonly el: Elements
  private readonly media: LessonMedia
  private outline: TourOutline | null = null
  private handlers: MissionTourHandlers | null = null
  private shownIndex = -1

  constructor(find: Find) {
    this.el = findElements(find)
    this.media = new LessonMedia(find('#mission-card-media'))
    find('#mission-prev').addEventListener('click', () => this.handlers?.previous())
    find('#mission-next').addEventListener('click', () => this.handlers?.next())
    this.el.play.addEventListener('click', () => this.handlers?.togglePause())
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.outline) this.handlers?.close()
    })
  }

  open(outline: TourOutline, handlers: MissionTourHandlers): void {
    this.outline = outline
    this.handlers = handlers
    this.shownIndex = -1
    this.renderTimeline(outline)
    this.el.root.hidden = false
    document.body.dataset.missionTour = outline.id
  }

  close(): void {
    this.outline = null
    this.handlers = null
    this.el.root.hidden = true
    this.el.fade.style.opacity = '0'
    this.media.show({})
    delete document.body.dataset.missionTour
  }

  showStation(index: number, card: StationCard): void {
    if (!this.outline) return
    this.shownIndex = index
    this.el.title.textContent = card.title
    this.el.text.textContent = card.text
    this.el.date.textContent = card.when
    this.el.flyby.hidden = !card.badge
    this.el.flyby.textContent = card.badge ?? ''
    this.el.facts.replaceChildren(...(card.facts ?? []).map(renderFact))
    this.el.facts.hidden = !card.facts?.length
    this.media.show(card)
  }

  // `status`: the line under the title (the distance from the Sun, the craft's height).
  update(state: TourState, status: string): void {
    this.el.fade.style.opacity = String(state.fade)
    this.el.distance.textContent = status
    this.showPlayState(state.paused)
    for (const item of this.el.timeline.querySelectorAll<HTMLElement>('li')) {
      const index = Number(item.dataset.index)
      item.classList.toggle('is-done', index < state.stationIndex)
      if (index === state.stationIndex) item.setAttribute('aria-current', 'step')
      else item.removeAttribute('aria-current')
    }
    this.el.root.classList.toggle('is-travelling', state.travelling && this.shownIndex !== state.stationIndex)
  }

  ended(): void {
    this.showPlayState(true)
  }

  // As in a lesson: the button says what it does - Pause while the tour runs, Play while it stands.
  private showPlayState(paused: boolean): void {
    const text = this.el.play.querySelector('.hud-dock-label')
    const label = paused ? msg.ui.dock.play : msg.ui.dock.pause
    if (!text || text.textContent === label) return
    text.textContent = label
    this.el.play.dataset.state = paused ? 'paused' : 'playing'
    this.el.play.setAttribute('aria-label', paused ? msg.missions.ui.play : msg.missions.ui.pause)
  }

  private renderTimeline(outline: TourOutline): void {
    this.el.timeline.setAttribute('aria-label', msg.missions.ui.timeline)
    this.el.timeline.replaceChildren(
      ...outline.stations.map((station, index) => {
        const item = document.createElement('li')
        item.dataset.index = String(index)
        const button = Object.assign(document.createElement('button'), { type: 'button', className: 'hud-mission-stop', title: station.title })
        button.setAttribute('aria-label', `${station.title}, ${station.mark}`)
        button.append(Object.assign(document.createElement('span'), { className: 'hud-mission-stop-year', textContent: station.mark }))
        button.addEventListener('click', () => this.handlers?.jumpTo(index))
        item.append(button)
        return item
      }),
    )
  }
}
