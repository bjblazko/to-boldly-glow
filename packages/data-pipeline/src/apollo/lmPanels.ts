import sharp from 'sharp'
import { blockText, blockTextWidth } from './blockLetters'

// Eagle's instrument panels as our own drawings: generic copies laid out after the handbook's panel
// drawings (not photographs) - flight director attitude indicators ("8-balls"), crosspointers, tape
// meters, round gauges, rows of toggle switches, caution lights, circuit breakers and the guidance
// computer's display and keyboard (DSKY) - in the LM's panel grey with white lettering, in our
// block letters (blockLetters.ts). Each panel is drawn at about 3,000 pixels per metre, so its
// labels stay sharp from where the crew stood.

export const PIXELS_PER_METRE = 3000
const GREY = '#5f6366'
const DARK = '#2b2d2f'
const WHITE = '#ecebe6'

type Rect = [x: number, y: number, w: number, h: number] // fractions of the panel

type Item =
  | { kind: 'ball'; at: Rect; label: string }
  | { kind: 'cross'; at: Rect; label: string }
  | { kind: 'tapes'; at: Rect; labels: string[] }
  | { kind: 'gauges'; at: Rect; labels: string[] }
  | { kind: 'switches'; at: Rect; labels: string[] }
  | { kind: 'lights'; at: Rect; labels: string[]; columns: number }
  | { kind: 'breakers'; at: Rect; labels: string[]; columns: number }
  | { kind: 'dsky'; at: Rect }
  | { kind: 'title'; at: Rect; text: string }
  | { kind: 'timer'; at: Rect; label: string; digits: string }

export interface PanelDrawing {
  file: string
  // The panel's size (metres): its picture is drawn at PIXELS_PER_METRE.
  size: [number, number]
  items: Item[]
}

interface Box {
  x: number
  y: number
  w: number
  h: number
}

// A label centred under (or over) an instrument, no wider than `maxWidth`.
function label(text: string, [centreX, top]: [number, number], height: number, maxWidth = Infinity): string {
  const fitted = Math.min(height, maxWidth / blockTextWidth(text, 1))
  return blockText(text, { left: centreX - blockTextWidth(text, fitted) / 2, top, height: fitted, color: WHITE })
}

// Splits a box into `count` cells across (and rows down).
function cells({ x, y, w, h }: Box, count: number, columns = count): Box[] {
  const rows = Math.ceil(count / columns)
  return Array.from({ length: count }, (_, index) => ({ x: x + (index % columns) * (w / columns), y: y + Math.floor(index / columns) * (h / rows), w: w / columns, h: h / rows }))
}

function ball(b: Box, text: string): string {
  const r = Math.min(b.w, b.h) * 0.36
  const [cx, cy] = [b.x + b.w / 2, b.y + b.h * 0.45]
  return `<rect x="${cx - r * 1.25}" y="${cy - r * 1.25}" width="${r * 2.5}" height="${r * 2.5}" rx="${r * 0.2}" fill="${DARK}"/>
<circle cx="${cx}" cy="${cy}" r="${r}" fill="#d9d6cc"/><path d="M${cx - r},${cy} A${r},${r} 0 0 0 ${cx + r},${cy} Z" fill="#1d1d1d"/>
<line x1="${cx - r * 0.6}" y1="${cy}" x2="${cx + r * 0.6}" y2="${cy}" stroke="#e09a2a" stroke-width="${r * 0.06}"/><circle cx="${cx}" cy="${cy}" r="${r * 0.06}" fill="#e09a2a"/>
${[-0.5, 0.5].map((k) => `<line x1="${cx - r * 0.9}" y1="${cy + k * r}" x2="${cx + r * 0.9}" y2="${cy + k * r}" stroke="#777" stroke-width="${r * 0.02}"/>`).join('')}
${label(text, [cx, cy + r * 1.35], b.h * 0.07, b.w * 0.9)}`
}

function cross(b: Box, text: string): string {
  const s = Math.min(b.w, b.h) * 0.62
  const [x, y] = [b.x + (b.w - s) / 2, b.y + b.h * 0.08]
  const ticks = Array.from({ length: 9 }, (_, k) => {
    const t = x + (s * (k + 1)) / 10
    return `<line x1="${t}" y1="${y + s / 2 - s * 0.03}" x2="${t}" y2="${y + s / 2 + s * 0.03}" stroke="${WHITE}" stroke-width="${s * 0.008}"/><line x1="${x + s / 2 - s * 0.03}" y1="${y + s * (k + 1) / 10}" x2="${x + s / 2 + s * 0.03}" y2="${y + s * (k + 1) / 10}" stroke="${WHITE}" stroke-width="${s * 0.008}"/>`
  })
  return `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="#141414"/><line x1="${x + s * 0.2}" y1="${y + s * 0.42}" x2="${x + s * 0.8}" y2="${y + s * 0.42}" stroke="#e8e8e8" stroke-width="${s * 0.025}"/><line x1="${x + s * 0.58}" y1="${y + s * 0.2}" x2="${x + s * 0.58}" y2="${y + s * 0.8}" stroke="#e8e8e8" stroke-width="${s * 0.025}"/>${ticks.join('')}${label(text, [b.x + b.w / 2, y + s * 1.08], b.h * 0.07, b.w * 0.9)}`
}

function tape(b: Box, text: string): string {
  const [w, h] = [b.w * 0.5, b.h * 0.68]
  const [x, y] = [b.x + (b.w - w) / 2, b.y + b.h * 0.05]
  const marks = Array.from({ length: 11 }, (_, k) => `<line x1="${x}" y1="${y + (h * k) / 10}" x2="${x + w * (k % 5 === 0 ? 0.55 : 0.3)}" y2="${y + (h * k) / 10}" stroke="#141414" stroke-width="${h * 0.008}"/>`)
  const digits = Array.from({ length: 3 }, (_, k) => blockText(String(30 - k * 10), { left: x + w * 0.6, top: y + (h * k * 5) / 10 - h * 0.02 + (k === 0 ? h * 0.03 : 0), height: h * 0.05, color: '#141414' }))
  return `<rect x="${x - w * 0.12}" y="${y - h * 0.03}" width="${w * 1.24}" height="${h * 1.06}" fill="${DARK}"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#e6e3d8"/>${marks.join('')}${digits.join('')}<polygon points="${x - w * 0.12},${y + h / 2 - h * 0.03} ${x},${y + h / 2} ${x - w * 0.12},${y + h / 2 + h * 0.03}" fill="#e09a2a"/>${label(text, [b.x + b.w / 2, y + h * 1.1], b.h * 0.07, b.w * 0.95)}`
}

function gauge(b: Box, text: string): string {
  const r = Math.min(b.w, b.h) * 0.3
  const [cx, cy] = [b.x + b.w / 2, b.y + b.h * 0.42]
  const ticks = Array.from({ length: 11 }, (_, k) => {
    const a = Math.PI * (0.75 + (k / 10) * 1.5)
    return `<line x1="${cx + Math.cos(a) * r * 0.8}" y1="${cy + Math.sin(a) * r * 0.8}" x2="${cx + Math.cos(a) * r * 0.95}" y2="${cy + Math.sin(a) * r * 0.95}" stroke="${WHITE}" stroke-width="${r * 0.04}"/>`
  })
  return `<circle cx="${cx}" cy="${cy}" r="${r * 1.12}" fill="${DARK}"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="#151515"/>${ticks.join('')}<line x1="${cx}" y1="${cy}" x2="${cx + r * 0.6}" y2="${cy - r * 0.45}" stroke="#f2f2f2" stroke-width="${r * 0.06}"/>${label(text, [cx, cy + r * 1.3], b.h * 0.07, b.w * 0.95)}`
}

// A toggle: its label above, a guard ring, the lever's tip.
function toggle(b: Box, text: string, index: number): string {
  const [cx, cy, r] = [b.x + b.w / 2, b.y + b.h * 0.62, Math.min(b.w, b.h) * 0.16]
  const up = index % 3 !== 1
  return `${label(text, [cx, b.y + b.h * 0.08], b.h * 0.12, b.w * 0.9)}<circle cx="${cx}" cy="${cy}" r="${r}" fill="${DARK}"/><circle cx="${cx}" cy="${cy}" r="${r * 0.55}" fill="#9a9a96"/><rect x="${cx - r * 0.18}" y="${up ? cy - r * 1.5 : cy}" width="${r * 0.36}" height="${r * 1.5}" rx="${r * 0.18}" fill="#d8d8d4"/>${label('ON', [cx - r * 2, cy - r * 1.4], r * 0.5)}${label('OFF', [cx - r * 2.2, cy + r * 0.9], r * 0.5)}`
}

function light(b: Box, text: string): string {
  const [x, y, w, h] = [b.x + b.w * 0.06, b.y + b.h * 0.12, b.w * 0.88, b.h * 0.76]
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#3a3a36"/>${blockText(text, { left: x + (w - blockTextWidth(text, h * 0.36)) / 2, top: y + h * 0.32, height: h * 0.36, color: '#8b8a80' })}`
}

function breaker(b: Box, text: string): string {
  const r = Math.min(b.w, b.h) * 0.16
  return `${label(text, [b.x + b.w / 2, b.y + b.h * 0.1], b.h * 0.16, b.w * 0.9)}<circle cx="${b.x + b.w / 2}" cy="${b.y + b.h * 0.62}" r="${r}" fill="#121212"/><circle cx="${b.x + b.w / 2}" cy="${b.y + b.h * 0.62}" r="${r * 0.55}" fill="#dcdad2"/>`
}

// The keyboard's keys in a grid of 7 columns by 3 rows (as on the real one): VERB and NOUN on the
// left, the signs and digits in columns, CLR, PRO and KEY REL, then ENTR and RSET on the right.
const DSKY_KEYS: [string, number, number][] = [
  ['VERB', 0, 0], ['NOUN', 0, 2], ['+', 1, 0], ['-', 1, 1], ['0', 1, 2], ['7', 2, 0], ['4', 2, 1], ['1', 2, 2], ['8', 3, 0], ['5', 3, 1], ['2', 3, 2],
  ['9', 4, 0], ['6', 4, 1], ['3', 4, 2], ['CLR', 5, 0], ['PRO', 5, 1], ['KEY REL', 5, 2], ['ENTR', 6, 0], ['RSET', 6, 2],
]

// The display (PROG, VERB, NOUN, three registers in green numerals) over the keyboard.
function dsky(b: Box): string {
  const display = { x: b.x + b.w * 0.05, y: b.y + b.h * 0.04, w: b.w * 0.9, h: b.h * 0.5 }
  const green = '#7dd38a'
  const rows = ['PROG  63', 'VERB 06  NOUN 63', '+01234', '-00512', '+00950'].map((text, k) => blockText(text, { left: display.x + display.w * 0.08, top: display.y + display.h * (0.07 + k * 0.18), height: display.h * 0.11, color: green }))
  const keys = cells({ x: b.x + b.w * 0.05, y: b.y + b.h * 0.58, w: b.w * 0.9, h: b.h * 0.4 }, 21, 7)
  const keyboard = DSKY_KEYS.map(([text, column, row]) => {
    const c = keys[row * 7 + column]
    const height = Math.min(c.h * 0.3, (c.w * 0.8) / blockTextWidth(text, 1))
    return `<rect x="${c.x + c.w * 0.06}" y="${c.y + c.h * 0.08}" width="${c.w * 0.88}" height="${c.h * 0.84}" rx="${c.w * 0.06}" fill="#d9d6cc"/>${blockText(text, { left: c.x + (c.w - blockTextWidth(text, height)) / 2, top: c.y + c.h * 0.36, height, color: '#1a1a1a' })}`
  })
  return `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="#3f4245"/><rect x="${display.x}" y="${display.y}" width="${display.w}" height="${display.h}" fill="#0f1210"/>${rows.join('')}${keyboard.join('')}`
}

type Renderers = { [Kind in Item['kind']]: (it: Extract<Item, { kind: Kind }>, b: Box) => string }

const RENDERERS: Renderers = {
  ball: (it, b) => ball(b, it.label),
  cross: (it, b) => cross(b, it.label),
  tapes: (it, b) => cells(b, it.labels.length).map((c, k) => tape(c, it.labels[k])).join(''),
  gauges: (it, b) => cells(b, it.labels.length).map((c, k) => gauge(c, it.labels[k])).join(''),
  switches: (it, b) => cells(b, it.labels.length).map((c, k) => toggle(c, it.labels[k], k)).join(''),
  lights: (it, b) => cells(b, it.labels.length, it.columns).map((c, k) => light(c, it.labels[k])).join(''),
  breakers: (it, b) => cells(b, it.labels.length, it.columns).map((c, k) => breaker(c, it.labels[k])).join(''),
  dsky: (_it, b) => dsky(b),
  title: (it, b) => label(it.text, [b.x + b.w / 2, b.y], b.h),
  timer: (it, b) => timer(b, it),
}

function timer(b: Box, { label: text, digits }: { label: string; digits: string }): string {
  const height = Math.min(b.h * 0.4, (b.w * 0.84) / blockTextWidth(digits, 1))
  return `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h * 0.7}" fill="#111"/>${blockText(digits, { left: b.x + b.w * 0.08, top: b.y + b.h * 0.15, height, color: '#e0503a' })}${label(text, [b.x + b.w / 2, b.y + b.h * 0.78], b.h * 0.14, b.w)}`
}

function item(it: Item, [width, height]: [number, number]): string {
  const [x, y, w, h] = it.at
  const render = RENDERERS[it.kind] as (it: Item, b: Box) => string
  return render(it, { x: x * width, y: y * height, w: w * width, h: h * height })
}

export function panelSvg({ size, items }: PanelDrawing): string {
  const [w, h] = [Math.round(size[0] * PIXELS_PER_METRE), Math.round(size[1] * PIXELS_PER_METRE)]
  const screws = [[0.012, 0.03], [0.988, 0.03], [0.012, 0.97], [0.988, 0.97]].map(([x, y]) => `<circle cx="${x * w}" cy="${y * h}" r="${Math.min(w, h) * 0.008}" fill="#3c3e40"/>`)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${GREY}"/>${screws.join('')}${items.map((it) => item(it, [w, h])).join('')}</svg>`
}

export async function panelTexture(drawing: PanelDrawing): Promise<Buffer> {
  return sharp(Buffer.from(panelSvg(drawing))).jpeg({ quality: 88, mozjpeg: true }).toBuffer()
}
