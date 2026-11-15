import { formatNumber, locale, msg } from '../../i18n/i18n'
import { LOCALE_TAGS } from '../../i18n/locale'
import type { ChapterChart } from '../lessonTypes'
import { renderLineChart } from './lineChart'

// Both files come with the app (packages/data-pipeline: fetchVoyagerTrajectories.ts,
// extractHeliopauseData.ts).
const SPEEDS_URL = 'data/voyager/speeds.json'
// Each probe's crossing: its data file, the day, and the time axis's ticks.
const CROSSINGS = {
  voyager1: { url: 'data/voyager/heliopause-voyager1.json', date: '2012-08-25', ticks: ['2012-06-01', '2012-09-01', '2012-12-01', '2013-02-01'] },
  voyager2: { url: 'data/voyager/heliopause-voyager2.json', date: '2018-11-05', ticks: ['2018-08-01', '2018-11-01', '2019-02-01', '2019-04-01'] },
}
const MS_PER_DAY = 86400000

const SPEED_COLOR = 'var(--chart-series-1)'
const ESCAPE_COLOR = 'var(--chart-series-2)'

// Voyager 2's closest approaches, as fractional years.
const FLYBYS = { jupiter: 1979.52, saturn: 1981.65, uranus: 1986.07, neptune: 1989.65 }
const GRAVITY_ASSIST_YEARS: [number, number] = [1977.6, 1990]

interface SpeedsFile {
  voyager2: [number, number, number][]
}

interface HeliopauseFile {
  rows: [string, number | null, number | null][]
}

async function json<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status} loading ${url}`)
  return (await response.json()) as T
}

async function gravityAssistChart(): Promise<HTMLElement[]> {
  const text = msg.voyager.charts.gravityAssist
  const rows = (await json<SpeedsFile>(SPEEDS_URL)).voyager2.filter(([year]) => year >= GRAVITY_ASSIST_YEARS[0] && year <= GRAVITY_ASSIST_YEARS[1])
  const chart = renderLineChart({
    title: text.unit,
    series: [
      { name: text.speed, color: SPEED_COLOR, points: rows.map(([year, speed]) => [year, speed]) },
      { name: text.escape, color: ESCAPE_COLOR, points: rows.map(([year, , escape]) => [year, escape]) },
    ],
    markers: Object.entries(FLYBYS).map(([planet, year]) => ({ x: year, label: text.flybys[planet as keyof typeof FLYBYS] })),
    formatX: (year) => String(Math.floor(year)),
    formatY: (speed) => formatNumber(speed, 1),
    xTicks: [1978, 1980, 1982, 1984, 1986, 1988, 1990],
  })
  return [chart]
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(LOCALE_TAGS[locale], { month: 'short', year: 'numeric', timeZone: 'UTC' })
}

// Two measures in different units: two charts above each other on the same dates, never one chart
// with two value axes.
async function heliopauseCharts(probe: keyof typeof CROSSINGS): Promise<HTMLElement[]> {
  const text = msg.voyager.charts.heliopause
  const crossing = CROSSINGS[probe]
  const rows = (await json<HeliopauseFile>(crossing.url)).rows.map(([date, protons, field]) => ({ day: Date.parse(date) / MS_PER_DAY, date, protons, field }))
  const formatX = (day: number) => shortDate(new Date(day * MS_PER_DAY).toISOString())
  const marker = { x: Date.parse(crossing.date) / MS_PER_DAY, label: shortDate(crossing.date) }
  const common = { markers: [marker], formatX, xTicks: crossing.ticks.map((date) => Date.parse(date) / MS_PER_DAY) }
  return [
    renderLineChart({ ...common, title: text.protons, logScale: true, series: [{ name: text.protons, color: SPEED_COLOR, points: rows.map((row) => [row.day, row.protons]) }], formatY: (value) => value.toExponential(0) }),
    renderLineChart({ ...common, title: text.field, series: [{ name: text.field, color: SPEED_COLOR, points: rows.map((row) => [row.day, row.field]) }], formatY: (value) => formatNumber(value, 2) }),
  ]
}

const CHARTS: Record<ChapterChart, { title: () => string; source: () => string; build: () => Promise<HTMLElement[]> }> = {
  gravityAssist: { title: () => msg.voyager.charts.gravityAssist.title, source: () => msg.voyager.charts.gravityAssist.source, build: gravityAssistChart },
  heliopauseVoyager1: { title: () => msg.voyager.charts.heliopause.title.voyager1, source: () => msg.voyager.charts.heliopause.source, build: () => heliopauseCharts('voyager1') },
  heliopauseVoyager2: { title: () => msg.voyager.charts.heliopause.title.voyager2, source: () => msg.voyager.charts.heliopause.source, build: () => heliopauseCharts('voyager2') },
}

// A chapter's chart with its heading and its source.
export async function renderChapterChart(chart: ChapterChart): Promise<HTMLElement> {
  const { title, source, build } = CHARTS[chart]
  const figure = Object.assign(document.createElement('figure'), { className: 'hud-lesson-chart' })
  const caption = Object.assign(document.createElement('figcaption'), { className: 'hud-lesson-media-credit', textContent: `${source()} · ${msg.voyager.bundledNote}` })
  figure.append(Object.assign(document.createElement('div'), { className: 'chart-heading', textContent: title() }), ...(await build()), caption)
  return figure
}
