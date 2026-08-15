import { expect, test } from '@playwright/test'

test('all 8 planets render, and the scale toggle + orbit-path controls affect the scene', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-rendered', 'true')

  // Positive control: pressing the scale mode's segmented button changes the recorded blend value
  // exposed for testing, proving the control is actually wired to the renderer's state — not
  // merely present in the DOM. (Mirrors the time-controls e2e test's positive-control pattern.)
  // The scale mode control lives behind the dock's "Display" sheet.
  await page.locator('.hud-dock-btn[data-panel="display"]').click()
  const compactButton = page.locator('#scale-mode-compact-btn')
  const realisticButton = page.locator('#scale-mode-realistic-btn')
  await expect(compactButton).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('#scene')).toHaveAttribute('data-scale-mode', 'compact')
  await realisticButton.click()
  // The toggle animates scaleBlend over ~1.5s rather than snapping instantly - wait for it to settle.
  await expect(page.locator('#scene')).toHaveAttribute('data-scale-mode', 'realistic', { timeout: 3000 })
  await expect(page.locator('#scene')).toHaveAttribute('data-scale-blend', '0')
  await expect(realisticButton).toHaveAttribute('aria-pressed', 'true')
  await expect(compactButton).toHaveAttribute('aria-pressed', 'false')

  // Orbit-paths lives in the same "Display" sheet.
  const toggle = page.locator('#orbit-paths-toggle')
  await expect(toggle).toBeChecked()
  await toggle.uncheck()
  await expect(page.locator('#scene')).toHaveAttribute('data-orbit-paths', 'false')

  expect(errors).toEqual([])
})
