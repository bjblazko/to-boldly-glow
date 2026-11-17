import { expect, test } from '@playwright/test'
import { openApp } from './support/appBoot'

test('switching camera mode shows its controls as keycaps; ? brings them back, Escape puts them away', async ({ page }) => {
  await openApp(page)
  const overlay = page.locator('#controls-overlay')
  await page.locator('.hud-dock-btn[data-panel="camera"]').click()
  await page.locator('#camera-mode-toggle').click()
  await expect(overlay).toBeVisible()
  await expect(overlay.locator('.hud-keycap[data-code="KeyW"]')).toHaveText('W')
  await expect(overlay.locator('.hud-keycap[data-code="ArrowUp"]')).toBeVisible()
  await expect(overlay.locator('.hud-keycap[data-code="KeyA"]')).toHaveCount(0)

  // A held key lights up on it.
  await page.keyboard.down('KeyQ')
  await expect(overlay.locator('.hud-keycap[data-code="KeyQ"]')).toHaveClass(/is-pressed/)
  await page.keyboard.up('KeyQ')
  await expect(overlay.locator('.hud-keycap[data-code="KeyQ"]')).not.toHaveClass(/is-pressed/)

  await page.keyboard.press('Escape')
  await expect(overlay).toBeHidden()
  await page.keyboard.press('Shift+Slash')
  await expect(overlay).toBeVisible()
  await page.keyboard.press('Shift+Slash')
  await expect(overlay).toBeHidden()

  // The camera panel's help button shows them too.
  if (!(await page.locator('#controls-help').isVisible())) await page.locator('.hud-dock-btn[data-panel="camera"]').click()
  await page.locator('#controls-help').click()
  await expect(overlay).toBeVisible()
  await expect(overlay).toContainText('steer the nose')
})

test('the controls fade by themselves after a few seconds', async ({ page }) => {
  await openApp(page)
  await page.locator('.hud-dock-btn[data-panel="camera"]').click()
  await page.locator('#camera-mode-toggle').click()
  await expect(page.locator('#controls-overlay')).toBeVisible()
  await expect(page.locator('#controls-overlay')).toBeHidden({ timeout: 10_000 })
})

test('a press on the scene puts the controls away', async ({ page }) => {
  await openApp(page)
  await page.keyboard.press('Shift+Slash')
  await expect(page.locator('#controls-overlay')).toBeVisible()
  await page.mouse.click(40, 500)
  await expect(page.locator('#controls-overlay')).toBeHidden()
})
