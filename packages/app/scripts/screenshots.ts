// The README's pictures: `npm run screenshots` in packages/app writes docs/images/*.jpg.
//
// Starts the app's dev server and stages each picture in Chrome (the scene uses WebGPU) with the
// supercut's stagecraft (scripts/supercut/stage.ts).

import { chromium, type Page } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { boot, drag, followBody, sceneOnly, setSwitch, sunBehindTarget, wait, zoom } from './supercut/stage'
import { KEEP_NAMES } from './supercut/soundtrack'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.resolve(APP, '../../docs/images')

type Shot = (page: Page, base: string) => Promise<void>

// The followed body with the Sun turned behind it, then the camera turned `offset` pixels around.
const sunlit = async (page: Page, base: string, body: string, offset: [number, number]) => {
  await boot(page, base)
  await setSwitch(page, '#body-labels-toggle', true)
  await followBody(page, body)
  await sunBehindTarget(page)
  await drag(page, offset)
  await setSwitch(page, '#body-labels-toggle', false)
}

// A lesson from the start page, paused (lessons turn their pages by themselves), `nexts` chapters
// on - each given time for its scene to settle.
const lessonAt = async (page: Page, base: string, id: string, nexts: number) => {
  await boot(page, base)
  await page.locator('#start-btn').click()
  await page.locator(`.hud-lesson-card[data-lesson-id="${id}"]`).click()
  await wait(2500)
  if ((await page.locator('#lesson-autoplay').getAttribute('aria-pressed')) === 'true') await page.locator('#lesson-autoplay').click()
  for (let i = 0; i < nexts; i++) {
    await page.locator('#lesson-next-chapter').click()
    await wait(2500)
  }
  await wait(2500)
}

// A mission tour from the start page, jumped to its station `index`, paused there.
const missionAt = async (page: Page, base: string, tour: string, index: number) => {
  await boot(page, base)
  await page.locator('#start-btn').click()
  await page.locator(`[data-tour-id="${tour}"]`).click()
  await wait(4000)
  await page.locator(`#mission-timeline li[data-index="${index}"] button`).click()
  await wait(9000)
  if ((await page.locator('#mission-play').getAttribute('data-state')) === 'playing') await page.locator('#mission-play').click()
  await wait(800)
}

const SHOTS: Record<string, Shot> = {
  // Earth's best side: its night side with the cities and the aurora, the Sun rising behind it,
  // Venus and Mercury beside it, with the orbits and the names.
  hero: async (page, base) => {
    await boot(page, base)
    await setSwitch(page, '#body-labels-toggle', true)
    await setSwitch(page, '#orbit-paths-toggle', true)
    await followBody(page, 'Earth')
    await sunBehindTarget(page)
    await drag(page, [-140, 70])
    await zoom(page, -3)
    await sceneOnly(page)
  },
  corona: async (page, base) => {
    await sunlit(page, base, 'Earth', [-12, 6])
    await zoom(page, -2)
    await sceneOnly(page)
  },
  saturn: async (page, base) => {
    await sunlit(page, base, 'Saturn', [480, -50])
    await sceneOnly(page)
  },
  // The inner Solar System with the orbits and names - and the bar at the bottom.
  compact: async (page, base) => {
    await boot(page, base)
    await setSwitch(page, '#orbit-paths-toggle', true)
    await setSwitch(page, '#body-labels-toggle', true)
    await zoom(page, 5)
  },
  // Free flight past Saturn, the controls overlay showing its keys.
  'free-flight': async (page, base) => {
    await sunlit(page, base, 'Saturn', [300, -40])
    await page.locator('#camera-mode-btn').click()
    await page.addStyleTag({ content: '.hud-controls { display: block !important; }' })
    await page.keyboard.press('Shift+Slash')
    // No focus ring on the camera key.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    await wait(800)
  },
  // What a first visit opens: the start page.
  start: async (page, base) => {
    await page.goto(`${base}/?lang=en`)
    await page.locator('#start-page:not([hidden])').waitFor({ timeout: 60_000 })
    await page.addStyleTag({ content: '.hud-beta-note { display: none !important; }' })
    await wait(2500)
  },
  'grand-tour': async (page, base) => {
    await boot(page, base)
    await page.locator('#start-btn').click()
    await page.locator('#start-grand').click()
    await wait(9000)
  },
  // Voyager 2 at Neptune, its station's card with NASA's photo, the stations in the bar.
  'voyager-tour': (page, base) => missionAt(page, base, 'voyager2', 4),
  'lesson-planets': (page, base) => lessonAt(page, base, 'planetSizes', 0),
  'lesson-seasons': (page, base) => lessonAt(page, base, 'seasons', 3),
  'lesson-moon': (page, base) => lessonAt(page, base, 'moonPhases', 3),
  'lesson-eclipse': (page, base) => lessonAt(page, base, 'solarEclipse', 6),
  'lesson-voyager': (page, base) => lessonAt(page, base, 'voyager', 1),
  'lesson-record': (page, base) => lessonAt(page, base, 'voyager', 2),
  'lesson-jupiter': (page, base) => lessonAt(page, base, 'voyager', 5),
  'lesson-taken-apart': (page, base) => lessonAt(page, base, 'voyagerDeepDive', 0),
  'lesson-saturn-v': (page, base) => lessonAt(page, base, 'saturnV', 2),
  'lesson-columbia': (page, base) => lessonAt(page, base, 'columbia', 5),
  'lesson-eagle': (page, base) => lessonAt(page, base, 'eagle', 0),
  'lesson-eagle-cockpit': (page, base) => lessonAt(page, base, 'eagle', 6),
  'lesson-apollo11': (page, base) => lessonAt(page, base, 'apollo11', 4),
  // More, on its Audio tab: the narrator, subtitles and the music.
  more: async (page, base) => {
    await boot(page, base)
    await followBody(page, 'Jupiter')
    await drag(page, [0, 160])
    await page.locator('#settings-btn').click()
    await page.locator('#settings-tab-audio').click()
    await wait(600)
  },
}

const server = await createServer({ root: APP, logLevel: 'error', server: { port: 0 } })
await server.listen()
const base = server.resolvedUrls!.local[0].replace(/\/$/, '')
const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-unsafe-webgpu'] })
try {
  const only = process.argv.slice(2)
  for (const [name, stage] of Object.entries(SHOTS)) {
    if (only.length && !only.includes(name)) continue
    // A fresh browser profile each time: the settings and lesson progress of one picture don't
    // carry into the next.
    const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, locale: 'en-GB' })
    await context.addInitScript(KEEP_NAMES)
    await context.addInitScript(() => localStorage.setItem('toBoldlyGlow.subtitles', 'on'))
    const page = await context.newPage()
    await stage(page, base)
    await page.mouse.move(1599, 899)
    await wait(500)
    await page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: 'jpeg', quality: 86 })
    await context.close()
    console.log(`  ${name}.jpg`)
  }
} finally {
  await browser.close()
  await server.close()
}
