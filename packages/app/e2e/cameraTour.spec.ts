import { expect, test } from '@playwright/test'
import { openApp, waitForFirstFrame } from './support/appBoot'

test('the tour toggle starts and stops from the keyboard', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await openApp(page)
  await page.locator('.hud-dock-btn[data-panel="camera"]').click()

  const tourButton = page.locator('#camera-tour-toggle')
  const tourLabel = tourButton.locator('.btn-label')
  await tourButton.focus()
  await page.keyboard.press('Enter')
  await expect(tourLabel).toHaveText('Stop Tour')

  // Regression: a window-level "any key stops the tour" listener used to stop it on keydown, and
  // the button's own click (from that same Enter) then started it again - so it never stopped.
  await page.keyboard.press('Enter')
  await expect(tourLabel).toHaveText('Start Tour')

  await page.keyboard.press('Space')
  await expect(tourLabel).toHaveText('Stop Tour')
  await page.keyboard.press('Space')
  await expect(tourLabel).toHaveText('Start Tour')

  expect(errors).toEqual([])
})

test('picking a search result during the tour stops it and flies to the result', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await openApp(page)
  await page.locator('.hud-dock-btn[data-panel="camera"]').click()

  const tourLabel = page.locator('#camera-tour-toggle .btn-label')
  await page.locator('#camera-tour-toggle').click()
  await expect(tourLabel).toHaveText('Stop Tour')

  // Opening Find and typing goes to the search box, not the camera, so it doesn't stop the tour on
  // its own...
  await page.locator('.hud-dock-btn[data-panel="find"]').click()
  await expect(tourLabel).toHaveText('Stop Tour')
  await page.locator('#entity-search-input').pressSequentially('Saturn')
  await expect(tourLabel).toHaveText('Stop Tour')

  // ...but choosing a result does, so the fly-to is actually what's on screen.
  await page.locator('#entity-search-input').press('Enter')
  await expect(page.locator('#scene')).toHaveAttribute('data-following-id', 'saturn')
  await expect(tourLabel).toHaveText('Start Tour')

  expect(errors).toEqual([])
})

test('the tour sets off on its own a moment after the scene first shows', async ({ page }) => {
  await page.goto('/')
  await waitForFirstFrame(page)
  const tourLabel = page.locator('#camera-tour-toggle .btn-label')
  await expect(tourLabel).toHaveText('Start Tour')
  await expect(tourLabel).toHaveText('Stop Tour', { timeout: 10_000 })
})

test('a click on the scene before the tour sets off keeps the camera still', async ({ page }) => {
  await page.goto('/')
  await waitForFirstFrame(page)
  await page.locator('#scene').click()
  await page.waitForTimeout(3000)
  await expect(page.locator('#camera-tour-toggle .btn-label')).toHaveText('Start Tour')
})
