import { expect, test } from '@playwright/test'
import { openApp } from './support/appBoot'
import { goTo } from './support/hud'

test('picking a body in the search locks the camera onto it', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await openApp(page)
  await goTo(page, 'Titan')
  await expect(page.locator('#scene')).toHaveAttribute('data-following-id', 'titan')
  await expect(page.locator('#command-palette')).toBeHidden()
  expect(errors).toEqual([])
})

test("a planet's name finds its moons too, after the planet itself", async ({ page }) => {
  await openApp(page)
  await page.locator('#search-btn').click()
  await page.locator('#palette-input').fill('Jupiter')
  const results = page.locator('#palette-results')
  await expect(results).toContainText('Jupiter')
  await expect(results).toContainText('Io')
  await expect(results).toContainText('Europa')
})

test('picking a body while in fly mode forces the camera back to orbit mode', async ({ page }) => {
  await openApp(page)
  await page.locator('#camera-mode-btn').click()
  await expect(page.locator('#camera-mode-btn')).toHaveAttribute('data-mode', 'fly')
  await goTo(page, 'Mars')
  await expect(page.locator('#camera-mode-btn')).toHaveAttribute('data-mode', 'orbit')
  await expect(page.locator('#scene')).toHaveAttribute('data-following-id', 'mars')
})

test('switching to free flight lets go of the followed body, and says so', async ({ page }) => {
  await openApp(page)
  await goTo(page, 'Mars')
  await expect(page.locator('#follow-indicator')).toBeVisible()
  await page.locator('#camera-mode-btn').click()
  await expect(page.locator('#follow-indicator')).toBeHidden()
  await expect(page.locator('#scene')).not.toHaveAttribute('data-following-id')
})
