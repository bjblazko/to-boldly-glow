import type { Page } from '@playwright/test'
import { boot, drag, followBody, hold, sceneOnly, setSwitch, sunBehindTarget, timeRate, wait, zoom } from './stage'

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
// around (0: the body eclipses the Sun), the clock at a rate preset if given, labels off again and
// the interface hidden.
async function sunlit(page: Page, base: string, body: string, offset: [number, number], rate?: number): Promise<void> {
  await boot(page, base)
  await setSwitch(page, '#body-labels-toggle', true)
  await followBody(page, body)
  await sunBehindTarget(page)
  await drag(page, offset)
  await setSwitch(page, '#body-labels-toggle', false)
  if (rate !== undefined) await timeRate(page, rate)
  await sceneOnly(page)
  await wait(800)
}

export const SCENES: Scene[] = [
  {
    // The planets running round the Sun, a month a second, and the camera diving into it.
    caption: 'The Solar System, live in your browser',
    bars: 2,
    prepare: async (page, base) => {
      await boot(page, base)
      await setSwitch(page, '#orbit-paths-toggle', true)
      await setSwitch(page, '#body-labels-toggle', true)
      await zoom(page, 6)
      await drag(page, [0, -90])
      await timeRate(page, 4)
      await sceneOnly(page)
    },
    act: async (page) => {
      await hold(page, ['ArrowRight'], 1200)
      await hold(page, ['ArrowRight', 'r'], 2200)
    },
  },
  {
    // Earth eclipsing the Sun, then the camera swings round to its day side.
    caption: 'Light, shadow and glow',
    bars: 2,
    prepare: (page, base) => sunlit(page, base, 'Earth', [-12, 6], 2),
    act: async (page) => {
      await wait(900)
      await hold(page, ['ArrowLeft'], 1300)
    },
  },
  {
    // Past the Moon, with Earth turning from day to a crescent in front of the Sun.
    caption: 'Fly around any world',
    bars: 2,
    prepare: (page, base) => sunlit(page, base, 'Moon', [300, 0]),
    act: (page) => hold(page, portrait(page) ? ['ArrowRight'] : ['ArrowRight', 'r'], 2600),
  },
  {
    caption: 'Every world on its real orbit',
    bars: 2,
    prepare: (page, base) => sunlit(page, base, 'Saturn', [480, -50]),
    act: async (page) => {
      await hold(page, ['ArrowRight'], 1400)
      if (!portrait(page)) await hold(page, ['r'], 700)
    },
  },
  {
    caption: 'True scale, or one you can take in',
    bars: 2,
    captionOnTop: true,
    prepare: async (page, base) => {
      await boot(page, base)
      await setSwitch(page, '#orbit-paths-toggle', true)
      await zoom(page, 6)
      await timeRate(page, 4)
    },
    act: async (page) => {
      const view = page.locator('.hud-dock-btn[data-panel="view"]:visible')
      await wait(400)
      await view.click()
      await page.locator('#scale-mode-realistic-btn').click()
      await view.click()
    },
  },
  {
    caption: 'Lessons that show it',
    bars: 2,
    captionOnTop: true,
    prepare: (page, base) => lesson(page, base, 'planetSizes'),
    act: async (page) => {
      await page.locator('#lesson-sort-btn').click()
      await wait(500)
      await page.locator('#lesson-sort-list [data-sorting-id="size"]').click()
    },
  },
  {
    // From the evening crescent to the first quarter, seen from the ground.
    caption: '…and read themselves out',
    bars: 2,
    captionOnTop: true,
    prepare: async (page, base) => {
      await lesson(page, base, 'moonPhases')
      for (let i = 0; i < 3; i++) {
        await page.locator('#lesson-next-chapter').click()
        await wait(2500)
      }
    },
    act: async (page) => {
      await wait(500)
      await page.locator('#lesson-next-chapter').click()
    },
  },
  {
    // The grand tour setting off from Earth: past the Moon and Venus, on to the Sun.
    caption: 'A narrated grand tour',
    bars: 2,
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

// The narrow portrait frame: a push-in there would fill it with the planet.
function portrait(page: Page): boolean {
  const { width, height } = page.viewportSize()!
  return height > width
}

// A lesson opened, its text card folded down so the scene shows.
async function lesson(page: Page, base: string, id: string): Promise<void> {
  await boot(page, base)
  await page.locator('#learn-mode-btn').click()
  await page.locator(`.hud-lesson-card[data-lesson-id="${id}"]`).click()
  await wait(2500)
  await page.locator('#lesson-text-toggle').click()
  await wait(800)
}
