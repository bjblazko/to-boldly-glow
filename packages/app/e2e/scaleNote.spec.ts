import { expect, test } from '@playwright/test'
import { openApp } from './support/appBoot'

test('the beta chip says the scale is compact while it is, and not once it is realistic', async ({ page }) => {
  await openApp(page)
  const scale = page.locator('#beta-chip .hud-beta-scale')
  await expect(scale).toBeVisible()
  await expect(scale).toContainText('compact scale')
  await page.locator('.hud-bar [data-panel="view"]:visible').click()
  await page.locator('#scale-mode-realistic-btn').click()
  await expect(scale).toBeHidden()
  await page.locator('#scale-mode-compact-btn').click()
  await expect(scale).toBeVisible()
})

test('the beta chip stays with the interface hidden', async ({ page }) => {
  await openApp(page)
  await page.keyboard.press('h')
  await expect(page.locator('#beta-chip')).toBeVisible()
  await expect(page.locator('#hud-bar')).toBeHidden()
})
