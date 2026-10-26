import type { Page } from '@playwright/test'
import { boot, drag, followBody, glide, lessonSceneOnly, sceneOnly, setSwitch, sunBehindTarget, timeRate, wait, zoom } from './stage'

// One shot of the film: set up off camera (`prepare`), then filmed for `bars` bars of the music
// while `act` runs.
export interface Scene {
  caption: string
  bars: number
  // Above the scene instead of at its foot, clear of a lesson's dock or the tour's subtitles.
  captionOnTop?: boolean
  prepare(page: Page, base: string): Promise<void>
  act(page: Page, seconds: number): Promise<void>
}

// The followed body with the Sun turned right behind it, the camera then turned `offset` pixels
// around (0: the body eclipses the Sun) and zoomed by `notches`, the clock at a rate preset if
// given; with labels and orbits if asked, the interface hidden.
async function sunlit(page: Page, base: string, body: string, { offset, notches = 0, rate, labels = false }: { offset: [number, number]; notches?: number; rate?: number; labels?: boolean }): Promise<void> {
  await boot(page, base)
  await setSwitch(page, '#body-labels-toggle', true)
  if (labels) await setSwitch(page, '#orbit-paths-toggle', true)
  await followBody(page, body)
  await sunBehindTarget(page)
  await drag(page, offset)
  if (notches) await zoom(page, notches)
  if (!labels) await setSwitch(page, '#body-labels-toggle', false)
  if (rate !== undefined) await timeRate(page, rate)
  await sceneOnly(page)
  await wait(800)
}

// The narrow portrait frame: a push-in there would fill it with the planet.
function portrait(page: Page): boolean {
  const { width, height } = page.viewportSize()!
  return height > width
}

// A lesson opened, once its camera has framed the first shot (only then may it be turned), with
// the interface hidden; its buttons are pressed from the page then.
async function lesson(page: Page, base: string, id: string): Promise<void> {
  await boot(page, base)
  await page.locator('#learn-mode-btn').click()
  await page.locator(`.hud-lesson-card[data-lesson-id="${id}"]`).click()
  await wait(5000)
  await lessonSceneOnly(page)
}

const press = (page: Page, selector: string) => page.evaluate((selector) => document.querySelector<HTMLElement>(selector)!.click(), selector)

export const SCENES: Scene[] = [
  {
    // The planets running round the Sun, a month a second, the camera drifting in towards it.
    caption: 'The Solar System, live in your browser',
    bars: 3,
    prepare: async (page, base) => {
      await boot(page, base)
      await setSwitch(page, '#orbit-paths-toggle', true)
      await setSwitch(page, '#body-labels-toggle', true)
      await zoom(page, 6)
      await drag(page, [0, -90])
      await timeRate(page, 4)
      await sceneOnly(page)
    },
    act: (page, seconds) => glide(page, [160, 40], seconds * 1000 - 400, portrait(page) ? -300 : -900),
  },
  {
    // From Earth's day side round to its night side, the Sun rising behind it.
    caption: 'Light, shadow and glow',
    bars: 3,
    prepare: (page, base) => sunlit(page, base, 'Earth', { offset: [-560, 70], notches: -3, rate: 2, labels: true }),
    act: (page, seconds) => glide(page, [420, 0], seconds * 1000 - 400, portrait(page) ? 0 : -120),
  },
  {
    caption: 'Every world on its real orbit',
    bars: 3,
    prepare: (page, base) => sunlit(page, base, 'Saturn', { offset: [480, -110] }),
    act: (page, seconds) => glide(page, [-140, -30], seconds * 1000 - 400, portrait(page) ? 0 : -100),
  },
  {
    // The seasons lesson flying from Earth's orbit in to Earth, its tilted axis and the Sun.
    caption: 'Lessons that show how it works',
    bars: 3,
    prepare: (page, base) => lesson(page, base, 'seasons'),
    act: async (page) => {
      await wait(700)
      await press(page, '#lesson-next-chapter')
    },
  },
  {
    // The planets side by side, seen from beside the Sun, lining up anew by size.
    caption: 'The planets, side by side at true scale',
    bars: 3,
    prepare: async (page, base) => {
      await lesson(page, base, 'planetSizes')
      await drag(page, [-300, -60])
      await wait(800)
    },
    act: async (page, seconds) => {
      const move = glide(page, [-60, -10], seconds * 1000 - 400, -150)
      await wait(1800)
      await press(page, '#lesson-sort-btn')
      await press(page, '#lesson-sort-list [data-sorting-id="size"]')
      await move
    },
  },
  {
    // The grand tour setting off from Earth: past the Moon and Venus, on to the Sun.
    caption: 'A narrated grand tour',
    bars: 3,
    captionOnTop: true,
    prepare: async (page, base) => {
      await boot(page, base)
      await followBody(page, 'Earth')
      await zoom(page, 2)
      await page.locator('#tours-mode-btn').click()
      await wait(500)
    },
    act: async (page) => {
      await page.locator('#tour-library [data-tour-id="grand"]').click()
    },
  },
]
