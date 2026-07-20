import { expect, test } from '@playwright/test'

test('bloom post-processing initializes and can be toggled', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-rendered', 'true')

  // Positive control: bloom setup succeeded (the HDR/mip-chain resources were created without
  // hitting the graceful-degradation fallback), not just that the toggle checkbox exists in the
  // DOM.
  await expect(page.locator('#scene')).toHaveAttribute('data-bloom-supported', 'true')

  // Display toggles live behind the dock's "Display" sheet — open it before interacting.
  await page.locator('.hud-dock-btn[data-panel="display"]').click()

  const toggle = page.locator('#bloom-toggle')
  await expect(toggle).toBeChecked()
  await toggle.uncheck()
  await expect(page.locator('#scene')).toHaveAttribute('data-bloom', 'false')

  expect(errors).toEqual([])
})
