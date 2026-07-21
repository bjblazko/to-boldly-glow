import { expect, test } from '@playwright/test'

test('entering and exiting learn mode toggles app-mode state and hides/restores the free-roam dock', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-rendered', 'true')

  await expect(page.locator('body')).not.toHaveAttribute('data-app-mode', 'learn')
  await expect(page.locator('.hud-dock')).toBeVisible()

  await page.locator('#learn-mode-btn').click()
  await page.locator('.hud-lesson-picker-item[data-lesson-id="seasons"]').click()

  await expect(page.locator('body')).toHaveAttribute('data-app-mode', 'learn')
  await expect(page.locator('body')).toHaveAttribute('data-lesson-id', 'seasons')
  await expect(page.locator('.hud-dock')).toBeHidden()
  await expect(page.locator('#display-corner-btn')).toBeVisible()

  await page.locator('#learn-mode-btn').click()

  await expect(page.locator('body')).not.toHaveAttribute('data-app-mode', 'learn')
  await expect(page.locator('.hud-dock')).toBeVisible()

  expect(errors).toEqual([])
})

test('the corner Display button still opens and closes its panel while in learn mode', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-rendered', 'true')

  await page.locator('#learn-mode-btn').click()
  await page.locator('.hud-lesson-picker-item[data-lesson-id="seasons"]').click()
  await expect(page.locator('body')).toHaveAttribute('data-app-mode', 'learn')

  const displayButton = page.locator('#display-corner-btn')
  const displayPanel = page.locator('.hud-sheet-panel[data-panel="display"]')

  await displayButton.click()
  await expect(displayButton).toHaveClass(/is-active/)
  await expect(displayPanel).toHaveClass(/is-active/)
  await expect(displayPanel).toBeVisible()

  await displayButton.click()
  await expect(displayButton).not.toHaveClass(/is-active/)
  await expect(displayPanel).not.toHaveClass(/is-active/)

  expect(errors).toEqual([])
})
