import type { Page } from '@playwright/test'
import { boot, drag, followBody, sceneOnly, setSwitch, sunBehindTarget, wait, zoom } from './stage'

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

// A slow turn around the followed body, spread over the shot.
const slowTurn = (dx: number, dy = 0) => (page: Page, seconds: number) => drag(page, [dx, dy], seconds * 1000 - 500)

// The followed body with the Sun turned right behind it, the camera then turned `offset` pixels
// around (0: the body eclipses the Sun), labels off again and the interface hidden.
async function sunlit(page: Page, base: string, body: string, offset: [number, number]): Promise<void> {
  await boot(page, base)
  await setSwitch(page, '#body-labels-toggle', true)
  await followBody(page, body)
  await sunBehindTarget(page)
  await drag(page, offset)
  await setSwitch(page, '#body-labels-toggle', false)
  await sceneOnly(page)
  await wait(800)
}

export const SCENES: Scene[] = [
  {
    caption: 'The Solar System, live in your browser',
    bars: 2,
    prepare: (page, base) => sunlit(page, base, 'Earth', [120, 0]),
    act: slowTurn(60, -10),
  },
  {
    caption: 'Light, shadow and glow',
    bars: 2,
    prepare: async (page, base) => {
      await sunlit(page, base, 'Earth', [-12, 6])
      await zoom(page, -2)
    },
    act: slowTurn(24, -6),
  },
  {
    caption: 'Every world on its real orbit',
    bars: 2,
    prepare: (page, base) => sunlit(page, base, 'Saturn', [480, -50]),
    act: slowTurn(-90, 10),
  },
  {
    caption: 'True scale, or one you can take in',
    bars: 2,
    captionOnTop: true,
    prepare: async (page, base) => {
      await boot(page, base)
      await setSwitch(page, '#orbit-paths-toggle', true)
      await zoom(page, 6)
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
    caption: '…and read themselves out',
    bars: 2,
    captionOnTop: true,
    // From the Moon's orbit seen from above to the evening crescent seen from the ground.
    prepare: async (page, base) => {
      await lesson(page, base, 'moonPhases')
      for (let i = 0; i < 2; i++) {
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
    caption: 'A narrated grand tour',
    bars: 2,
    captionOnTop: true,
    prepare: (page, base) => boot(page, base),
    act: async (page) => {
      await page.locator('#tours-mode-btn').click()
      await wait(700)
      await page.locator('#tour-library [data-tour-id="grand"]').click()
    },
  },
]

// A lesson opened, its text card folded down so the scene shows.
async function lesson(page: Page, base: string, id: string): Promise<void> {
  await boot(page, base)
  await page.locator('#learn-mode-btn').click()
  await page.locator(`.hud-lesson-card[data-lesson-id="${id}"]`).click()
  await wait(2500)
  await page.locator('#lesson-text-toggle').click()
  await wait(800)
}
