import { expect, test } from '@playwright/test'
import { openApp } from './support/appBoot'

test("a dock panel's close button closes the sheet and hands focus back to its dock button", async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await openApp(page)

  const sheet = page.locator('#hud-sheet')
  const timeButton = page.locator('.hud-dock-btn[data-panel="time"]')
  const timePanel = page.locator('.hud-sheet-panel[data-panel="time"]')

  await timeButton.click()
  await expect(sheet).toHaveClass(/is-open/)
  await expect(timePanel).toBeVisible()

  await timePanel.locator('[data-sheet-close]').click()
  await expect(sheet).not.toHaveClass(/is-open/)
  await expect(timeButton).not.toHaveClass(/is-active/)
  await expect(timeButton).toBeFocused()

  // Closed by its own button, the panel opens again with a single dock click.
  await timeButton.click()
  await expect(sheet).toHaveClass(/is-open/)
  await expect(timePanel).toBeVisible()

  expect(errors).toEqual([])
})
