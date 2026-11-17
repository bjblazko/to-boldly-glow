import { expect, test } from '@playwright/test'
import { openApp } from './support/appBoot'
import { goTo, startGrandTour } from './support/hud'

const context = (page: import('@playwright/test').Page) => page.locator('body')

test('a key press hands control back from the tour, in free flight', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await openApp(page)
  await startGrandTour(page)
  await expect(context(page)).toHaveAttribute('data-context', 'tour')

  await page.keyboard.press('KeyW')
  await expect(context(page)).toHaveAttribute('data-context', 'explore')
  await expect(page.locator('#camera-fly-btn')).toHaveAttribute('aria-pressed', 'true')
  expect(errors).toEqual([])
})

test("the bar's End tour stops the tour, and Enter on it does not start anything again", async ({ page }) => {
  await openApp(page)
  await startGrandTour(page)
  await expect(page.locator('#leave-label')).toHaveText('End tour')
  // Regression: a window-level "any key stops the tour" listener and the button's own click
  // (from that same Enter) must not fight.
  await page.locator('#leave-btn').focus()
  await page.keyboard.press('Enter')
  await expect(context(page)).toHaveAttribute('data-context', 'explore')
  await expect(page.locator('#leave-btn')).toBeHidden()
})

test('picking a search result during the tour stops it and flies to the result', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await openApp(page)
  await startGrandTour(page)

  // During the tour the bar is its player; Ctrl+K still searches. Typing goes to the search box,
  // not the camera, so it doesn't stop the tour on its own...
  await page.keyboard.press('Control+k')
  await page.locator('#palette-input').pressSequentially('Saturn')
  await expect(context(page)).toHaveAttribute('data-context', 'tour')

  // ...but choosing a result does, so the fly-to is actually what's on screen.
  await page.locator('#palette-input').press('Enter')
  await expect(page.locator('#scene')).toHaveAttribute('data-following-id', 'saturn')
  await expect(context(page)).toHaveAttribute('data-context', 'explore')
  expect(errors).toEqual([])
})

test('the follow chip names the followed body and lets go of it', async ({ page }) => {
  await openApp(page)
  await goTo(page, 'Mars')
  await expect(page.locator('#follow-indicator')).toBeVisible()
  await expect(page.locator('#follow-indicator-label')).toContainText('Mars')
  await page.locator('#follow-stop-button').click()
  await expect(page.locator('#follow-indicator')).toBeHidden()
  await expect(page.locator('#scene')).not.toHaveAttribute('data-following-id')
})
