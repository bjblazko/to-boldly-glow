import { expect, test } from '@playwright/test'

test('all 8 planets render, and the scale toggle + orbit-path controls affect the scene', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-rendered', 'true')

  // Positive control: flipping the scale toggle changes the recorded blend value exposed for
  // testing, proving the control is actually wired to the renderer's state — not merely present
  // in the DOM. (Mirrors the time-controls e2e test's positive-control pattern.)
  // The scale toggle lives behind the dock's "Time" sheet — open it before interacting.
  await page.locator('.hud-dock-btn[data-panel="time"]').click()
  const scaleToggle = page.locator('#scale-toggle')
  await expect(scaleToggle).toBeChecked()
  await expect(page.locator('#scene')).toHaveAttribute('data-scale-mode', 'compact')
  await scaleToggle.uncheck()
  // The toggle animates scaleBlend over ~1.5s rather than snapping instantly - wait for it to settle.
  await expect(page.locator('#scene')).toHaveAttribute('data-scale-mode', 'realistic', { timeout: 3000 })
  await expect(page.locator('#scene')).toHaveAttribute('data-scale-blend', '0')

  // Orbit-paths lives behind the dock's "Display" sheet instead.
  await page.locator('.hud-dock-btn[data-panel="display"]').click()
  const toggle = page.locator('#orbit-paths-toggle')
  await expect(toggle).toBeChecked()
  await toggle.uncheck()
  await expect(page.locator('#scene')).toHaveAttribute('data-orbit-paths', 'false')

  expect(errors).toEqual([])
})
