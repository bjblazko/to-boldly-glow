import { expect, test } from '@playwright/test'

test('searching and selecting an entity locks the camera onto it', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-rendered', 'true')

  await page.locator('#entity-search-input').fill('Titan')
  await page.locator('#entity-search-results').getByText('Titan (Moon)', { exact: true }).click()

  await expect(page.locator('#scene')).toHaveAttribute('data-following-id', 'titan')
  await expect(page.locator('#follow-indicator')).toBeVisible()
  await expect(page.locator('#follow-indicator-label')).toHaveText('Following: Titan')

  await page.locator('#follow-stop-button').click()
  await expect(page.locator('#scene')).not.toHaveAttribute('data-following-id')
  await expect(page.locator('#follow-indicator')).toBeHidden()

  expect(errors).toEqual([])
})

test('selecting a search result while in fly mode forces the camera back to orbit mode', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-rendered', 'true')

  const modeToggle = page.locator('#camera-mode-toggle')
  await modeToggle.click()
  await expect(modeToggle).toHaveText('Switch to Orbit Camera')

  await page.locator('#entity-search-input').fill('Mars')
  await page.locator('#entity-search-results').getByText('Mars (Planet)', { exact: true }).click()

  await expect(modeToggle).toHaveText('Switch to Free-fly Camera')
  await expect(page.locator('#scene')).toHaveAttribute('data-following-id', 'mars')
})
