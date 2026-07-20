import { expect, test } from '@playwright/test'

test('moons and lens flares can each be toggled independently', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-rendered', 'true')

  // Display toggles live behind the dock's "Display" sheet — open it before interacting.
  await page.locator('.hud-dock-btn[data-panel="display"]').click()

  const moonsToggle = page.locator('#moons-toggle')
  await expect(moonsToggle).toBeChecked()
  await moonsToggle.uncheck()
  await expect(page.locator('#scene')).toHaveAttribute('data-moons', 'false')

  const flaresToggle = page.locator('#flares-toggle')
  await expect(flaresToggle).toBeChecked()
  await flaresToggle.uncheck()
  await expect(page.locator('#scene')).toHaveAttribute('data-flares', 'false')

  // Turning bloom off must not affect the (now independently toggled) flares state.
  const bloomToggle = page.locator('#bloom-toggle')
  await bloomToggle.uncheck()
  await expect(page.locator('#scene')).toHaveAttribute('data-bloom', 'false')
  await expect(page.locator('#scene')).toHaveAttribute('data-flares', 'false')

  expect(errors).toEqual([])
})
