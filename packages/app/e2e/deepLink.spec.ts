import { expect, test } from '@playwright/test'
import { waitForFirstFrame } from './support/appBoot'
import { exitLesson } from './support/hud'

test('a link opens a lesson at its chapter, the address follows the chapters, and leaving clears it', async ({ page }) => {
  await page.goto('/?tour=off#lesson/apollo11/landing')
  await waitForFirstFrame(page)
  await expect(page.locator('#lesson-panel')).toHaveAttribute('data-chapter-id', 'landing')
  expect(new URL(page.url()).hash).toBe('#lesson/apollo11/landing')
  await page.locator('#lesson-next-chapter').click()
  await expect(page.locator('#lesson-panel')).toHaveAttribute('data-chapter-id', 'surface')
  await expect.poll(() => new URL(page.url()).hash).toBe('#lesson/apollo11/surface')
  await exitLesson(page)
  await expect.poll(() => new URL(page.url()).hash).toBe('')
})

test('a link changed while the app is open is followed too', async ({ page }) => {
  await page.goto('/?tour=off')
  await waitForFirstFrame(page)
  await page.evaluate(() => (window.location.hash = '#lesson/saturnV/sivb'))
  await expect(page.locator('#lesson-panel')).toHaveAttribute('data-chapter-id', 'sivb')
})
