import { formatNumber, locale, msg } from '../i18n/i18n'
import { LOCALE_TAGS } from '../i18n/locale'
import { renderFact } from '../learn/lessonPanel'
import { LessonMedia } from '../learn/lessonMedia'
import type { MissionMoment } from './missionPlayer'
import type { Mission } from './missionTimeline'

type Find = <T extends HTMLElement>(selector: string) => T

export interface MissionTourHandlers {
  togglePause(): void
  previous(): void
  next(): void
  jumpTo(index: number): void
  close(): void
}

// Light needs about 499 seconds per AU.
const LIGHT_HOURS_PER_AU = 499.005 / 3600

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
  private mission: Mission | null = null
  private handlers: MissionTourHandlers | null = null
  private shownIndex = -1

  constructor(find: Find) {
    this.el = findElements(find)
    this.media = new LessonMedia(find('#mission-card-media'))
    find('#mission-prev').addEventListener('click', () => this.handlers?.previous())
    find('#mission-next').addEventListener('click', () => this.handlers?.next())
    this.el.play.addEventListener('click', () => this.handlers?.togglePause())
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.mission) this.handlers?.close()
    })
  }

  open(mission: Mission, handlers: MissionTourHandlers): void {
    this.mission = mission
    this.handlers = handlers
    this.shownIndex = -1
    this.renderTimeline(mission)
    this.el.root.hidden = false
    document.body.dataset.missionTour = mission.probe
  }

  close(): void {
    this.mission = null
    this.handlers = null
    this.el.root.hidden = true
    this.el.fade.style.opacity = '0'
    this.media.show({})
    delete document.body.dataset.missionTour
  }

  showStation(index: number): void {
    const mission = this.mission
    if (!mission) return
    const station = mission.stations[index]
    const text = msg.missions[mission.probe].stations[station.id]
    this.shownIndex = index
    this.el.title.textContent = text.title
    this.el.text.textContent = text.text
    this.el.date.textContent = new Date(station.date).toLocaleDateString(LOCALE_TAGS[locale], { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
    this.el.flyby.hidden = !station.encounter
    this.el.flyby.textContent = msg.missions.ui.flyby
    this.el.facts.replaceChildren(...(station.facts ?? []).map(renderFact))
    this.el.facts.hidden = !station.facts?.length
    this.media.show(station)
  }

  update(moment: MissionMoment, distanceAu: number): void {
    this.el.fade.style.opacity = String(moment.fade)
    this.el.distance.textContent = msg.missions.ui.distance(formatNumber(distanceAu, 1), formatNumber(distanceAu * LIGHT_HOURS_PER_AU, 1))
    const paused = moment.paused || moment.phase === 'end'
    this.showPlayState(paused)
    for (const item of this.el.timeline.querySelectorAll<HTMLElement>('li')) {
      const index = Number(item.dataset.index)
      item.classList.toggle('is-done', index < moment.stationIndex)
      if (index === moment.stationIndex) item.setAttribute('aria-current', 'step')
      else item.removeAttribute('aria-current')
    }
    this.el.root.classList.toggle('is-travelling', moment.phase === 'flight' && this.shownIndex !== moment.stationIndex)
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

  private renderTimeline(mission: Mission): void {
    const texts = msg.missions[mission.probe].stations
    this.el.timeline.setAttribute('aria-label', msg.missions.ui.timeline)
    this.el.timeline.replaceChildren(
      ...mission.stations.map((station, index) => {
        const item = document.createElement('li')
        item.dataset.index = String(index)
        const button = Object.assign(document.createElement('button'), { type: 'button', className: 'hud-mission-stop', title: texts[station.id].title })
        button.setAttribute('aria-label', `${texts[station.id].title}, ${station.date.slice(0, 4)}`)
        button.append(Object.assign(document.createElement('span'), { className: 'hud-mission-stop-year', textContent: station.date.slice(0, 4) }))
        button.addEventListener('click', () => this.handlers?.jumpTo(index))
        item.append(button)
        return item
      }),
    )
  }
}
