import { expect, test } from '@playwright/test'
import { openApp } from './support/appBoot'

test('the beta note says the Compact scale is not true to scale, and opens View to change it', async ({ page }) => {
  await openApp(page)
  const note = page.locator('.hud-scale-note')
  await expect(note).toBeVisible()
  await expect(note).toContainText('View')
  await note.click()
  await page.locator('#scale-mode-realistic-btn').click()
  await expect(note).toBeHidden()
  await page.locator('#scale-mode-compact-btn').click()
  await expect(note).toBeVisible()
})

test('the scale note stays with the interface hidden, and brings it back to open View', async ({ page }) => {
  await openApp(page)
  await page.keyboard.press('h')
  const note = page.locator('.hud-scale-note')
  await expect(note).toBeVisible()
  await note.click()
  await expect(page.locator('body')).not.toHaveAttribute('data-ui-hidden')
  await expect(page.locator('#scale-mode-realistic-btn')).toBeVisible()
})
