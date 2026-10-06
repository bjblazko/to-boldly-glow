import { expect, test } from '@playwright/test'
import { openApp } from './support/appBoot'

test('body labels show each name and can be toggled off', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await openApp(page)

  const labels = page.locator('#body-labels .body-label')
  await expect(labels).toHaveCount(9) // Sun + 8 planets
  await expect(page.locator('#body-labels .body-label', { hasText: 'Sun' })).toBeVisible()
  await expect(page.locator('#body-labels .body-label', { hasText: 'Neptune' })).toBeAttached()
  // The clock starts at today's date, so whether Earth is inside the default view depends on the
  // day the test runs - fly to it first so its label's visibility doesn't.
  await page.locator('.hud-dock-btn[data-panel="camera"]').click()
  await page.locator('#entity-search-input').fill('Earth')
  await page.locator('#entity-search-input').press('Enter')
  await page.locator('.hud-dock-btn[data-panel="camera"]').click()
  await expect(page.locator('#body-labels .body-label', { hasText: 'Earth' })).toBeVisible()

  // Positive control: unchecking the toggle actually hides the labels container, not just the
  // checkbox's own visual state. (Mirrors the scale-toggle/orbit-paths positive-control pattern
  // in solarSystem.spec.ts.)
  // Display toggles live behind the dock's "Display" sheet — open it before interacting.
  await page.locator('.hud-dock-btn[data-panel="display"]').click()
  const toggle = page.locator('#body-labels-toggle')
  await expect(toggle).toBeChecked()
  await expect(page.locator('#body-labels')).toBeVisible()
  await toggle.uncheck()
  await expect(page.locator('#scene')).toHaveAttribute('data-labels-visible', 'false')
  await expect(page.locator('#body-labels')).toBeHidden()

  expect(errors).toEqual([])
})
