import { expect, test, type Page } from '@playwright/test'
import { openApp } from './support/appBoot'
import { openLesson } from './support/hud'

// The narration clips the page asks for, by path.
function clipRequests(page: Page): string[] {
  const clips: string[] = []
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname
    if (/^\/narration\/.*\.(webm|mp3)$/.test(path)) clips.push(path)
  })
  return clips
}

test('a lesson reads each chapter out as it is shown', async ({ page }) => {
  const clips = clipRequests(page)
  await openApp(page)
  await openLesson(page, 'seasons')
  await expect.poll(() => clips).toContain('/narration/lyra/en/lesson-seasons-orbit.webm')
  await page.locator('#lesson-next-chapter').click()
  await expect.poll(() => clips).toContain('/narration/lyra/en/lesson-seasons-intro.webm')
})

test('the planets lesson speaks a planet in the tour’s words, and a new order of the planets', async ({ page }) => {
  const clips = clipRequests(page)
  await openApp(page)
  await openLesson(page, 'planetSizes')
  await expect.poll(() => clips).toContain('/narration/lyra/en/lesson-planetSizes-lineup.webm')
  await page.locator('#lesson-next-chapter').click()
  await expect.poll(() => clips).toContain('/narration/lyra/en/mercury-orbit.webm')
  await page.locator('#lesson-sort-btn').click()
  await page.locator('#lesson-sort-list [data-sorting-id="size"]').click()
  await expect.poll(() => clips).toContain('/narration/lyra/en/order-size.webm')
})

test('with the narrator’s voice off in Settings, lessons stay silent', async ({ page }) => {
  const clips = clipRequests(page)
  await openApp(page)
  await page.locator('#settings-btn').click()
  await page.locator('#settings-tab-audio').click()
  await page.locator('#narration-sound-toggle').click({ force: true })
  await page.locator('#settings-btn').click()
  await openLesson(page, 'seasons')
  await page.waitForTimeout(1000)
  expect(clips).toEqual([])
})
