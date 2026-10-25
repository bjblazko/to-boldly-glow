import { expect, test } from '@playwright/test'
import { openApp } from './support/appBoot'

test('the beta note says the Compact scale is not true to scale, and where to change it', async ({ page }) => {
  await openApp(page)
  const note = page.locator('.hud-scale-note')
  await expect(note).toBeVisible()
  await expect(note).toContainText('View')
  await page.locator('.hud-dock-btn[data-panel="view"]:visible').click()
  await page.locator('#scale-mode-realistic-btn').click()
  await expect(note).toBeHidden()
  await page.locator('#scale-mode-compact-btn').click()
  await expect(note).toBeVisible()
})
