// A small line chart for the lesson panel, as inline SVG: one value axis, a time axis, thin lines,
// labelled event markers, a legend for two or more series, a crosshair with the values under the
// pointer, and the data as a table for screen readers.

export interface ChartSeries {
  name: string
  // A CSS color (one of the chart palette's custom properties).
  color: string
  // [x, y] points; y null where nothing was measured.
  points: [number, number | null][]
}

export interface ChartMarker {
  x: number
  label: string
}

export interface LineChartSpec {
  title: string
  series: ChartSeries[]
  markers?: ChartMarker[]
  yLabel?: string
  logScale?: boolean
  formatX: (x: number) => string
  formatY: (y: number) => string
  xTicks: number[]
}

const SVG = 'http://www.w3.org/2000/svg'
const WIDTH = 320
const HEIGHT = 128
const PAD = { left: 34, right: 8, top: 10, bottom: 18 }
const TABLE_ROWS = 12

interface Scales {
  x: (value: number) => number
  y: (value: number) => number
  yTicks: number[]
  xRange: [number, number]
}

function svgElement<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string | number>): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG, tag)
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value))
  return element
}

function extent(values: number[]): [number, number] {
  return [Math.min(...values), Math.max(...values)]
}

function scales(spec: LineChartSpec): Scales {
  const xs = spec.series.flatMap((series) => series.points.map(([x]) => x))
  const ys = spec.series.flatMap((series) => series.points.flatMap(([, y]) => (y === null ? [] : [y])))
  const xRange = extent(xs)
  const transform = spec.logScale ? Math.log10 : (value: number) => value
  const [low, high] = spec.logScale ? extent(ys.map(Math.log10)).map((value, index) => (index === 0 ? Math.floor(value) : Math.ceil(value))) : [0, niceCeiling(extent(ys)[1])]
  const yTicks = spec.logScale ? range(low, high).map((power) => 10 ** power) : [0, high / 2, high]
  return {
    x: (value) => PAD.left + ((value - xRange[0]) / (xRange[1] - xRange[0])) * (WIDTH - PAD.left - PAD.right),
    y: (value) => HEIGHT - PAD.bottom - ((transform(value) - low) / (high - low)) * (HEIGHT - PAD.top - PAD.bottom),
    yTicks,
    xRange,
  }
}

function niceCeiling(value: number): number {
  const step = 10 ** Math.floor(Math.log10(value))
  return Math.ceil(value / step) * step
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, index) => from + index)
}

function axes(spec: LineChartSpec, s: Scales): SVGGElement {
  const group = svgElement('g', { class: 'chart-axes' })
  for (const tick of s.yTicks) {
    group.append(svgElement('line', { x1: PAD.left, x2: WIDTH - PAD.right, y1: s.y(tick), y2: s.y(tick), class: 'chart-grid' }))
    group.append(Object.assign(svgElement('text', { x: PAD.left - 4, y: s.y(tick) + 3, 'text-anchor': 'end', class: 'chart-tick' }), { textContent: spec.formatY(tick) }))
  }
  for (const tick of spec.xTicks) group.append(Object.assign(svgElement('text', { x: s.x(tick), y: HEIGHT - 4, 'text-anchor': 'middle', class: 'chart-tick' }), { textContent: spec.formatX(tick) }))
  return group
}

// The line breaks where nothing was measured.
function seriesPath(series: ChartSeries, s: Scales): SVGPathElement {
  let path = ''
  let drawing = false
  for (const [x, y] of series.points) {
    if (y === null || y <= 0) {
      drawing = false
      continue
    }
    path += `${drawing ? 'L' : 'M'}${s.x(x).toFixed(1)},${s.y(y).toFixed(1)}`
    drawing = true
  }
  return svgElement('path', { d: path, class: 'chart-line', style: `stroke: ${series.color}` })
}

function markers(spec: LineChartSpec, s: Scales): SVGGElement {
  const group = svgElement('g', { class: 'chart-markers' })
  for (const marker of spec.markers ?? []) {
    const x = s.x(marker.x)
    group.append(svgElement('line', { x1: x, x2: x, y1: PAD.top, y2: HEIGHT - PAD.bottom, class: 'chart-marker' }))
    group.append(Object.assign(svgElement('text', { x: x + 2, y: PAD.top + 6, class: 'chart-marker-label' }), { textContent: marker.label }))
  }
  return group
}

function legend(spec: LineChartSpec): HTMLElement {
  const list = Object.assign(document.createElement('ul'), { className: 'chart-legend' })
  list.hidden = spec.series.length < 2
  for (const series of spec.series) {
    const item = document.createElement('li')
    const key = Object.assign(document.createElement('span'), { className: 'chart-key' })
    key.style.background = series.color
    item.append(key, document.createTextNode(series.name))
    list.append(item)
  }
  return list
}

// For screen readers: every series' value at a dozen evenly spread points.
function dataTable(spec: LineChartSpec): HTMLTableElement {
  const table = Object.assign(document.createElement('table'), { className: 'visually-hidden' })
  table.createCaption().textContent = spec.title
  const head = table.createTHead().insertRow()
  for (const text of ['', ...spec.series.map((series) => series.name)]) head.append(Object.assign(document.createElement('th'), { textContent: text }))
  const first = spec.series[0].points
  const body = table.createTBody()
  for (let row = 0; row < TABLE_ROWS; row++) {
    const index = Math.round((row / (TABLE_ROWS - 1)) * (first.length - 1))
    const cells = [spec.formatX(first[index][0]), ...spec.series.map((series) => formatValue(spec, series.points[index]?.[1] ?? null))]
    const tableRow = body.insertRow()
    for (const text of cells) tableRow.insertCell().textContent = text
  }
  return table
}

function formatValue(spec: LineChartSpec, value: number | null): string {
  return value === null ? '–' : spec.formatY(value)
}

// The crosshair and the values of every series nearest to the pointer.
function hoverLayer(spec: LineChartSpec, s: Scales, svg: SVGSVGElement, tooltip: HTMLElement): void {
  const crosshair = svgElement('line', { y1: PAD.top, y2: HEIGHT - PAD.bottom, class: 'chart-crosshair', visibility: 'hidden' })
  svg.append(crosshair)
  svg.addEventListener('pointermove', (event) => {
    const box = svg.getBoundingClientRect()
    const x = s.xRange[0] + (((event.clientX - box.left) / box.width) * WIDTH - PAD.left) / (WIDTH - PAD.left - PAD.right) * (s.xRange[1] - s.xRange[0])
    const nearest = spec.series.map((series) => series.points.reduce((best, point) => (Math.abs(point[0] - x) < Math.abs(best[0] - x) ? point : best)))
    crosshair.setAttribute('x1', String(s.x(nearest[0][0])))
    crosshair.setAttribute('x2', String(s.x(nearest[0][0])))
    crosshair.setAttribute('visibility', 'visible')
    tooltip.hidden = false
    tooltip.textContent = [spec.formatX(nearest[0][0]), ...spec.series.map((series, index) => `${series.name}: ${formatValue(spec, nearest[index][1])}`)].join(' · ')
  })
  svg.addEventListener('pointerleave', () => {
    crosshair.setAttribute('visibility', 'hidden')
    tooltip.hidden = true
  })
}

export function renderLineChart(spec: LineChartSpec): HTMLElement {
  const s = scales(spec)
  const svg = svgElement('svg', { viewBox: `0 0 ${WIDTH} ${HEIGHT}`, class: 'chart-plot', role: 'img', 'aria-label': spec.title })
  svg.append(axes(spec, s), markers(spec, s), ...spec.series.map((series) => seriesPath(series, s)))
  const tooltip = Object.assign(document.createElement('div'), { className: 'chart-tooltip', hidden: true })
  hoverLayer(spec, s, svg, tooltip)
  const chart = Object.assign(document.createElement('div'), { className: 'chart' })
  const title = Object.assign(document.createElement('div'), { className: 'chart-title', textContent: spec.yLabel ? `${spec.title} (${spec.yLabel})` : spec.title })
  chart.append(title, legend(spec), svg, tooltip, dataTable(spec))
  return chart
}
