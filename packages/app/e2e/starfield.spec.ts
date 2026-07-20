import { expect, test } from '@playwright/test'

test('a real star catalog loads and the starfield can be toggled', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-rendered', 'true')

  // Positive control: assert a real catalog loaded (thousands of stars), not a silent
  // zero-star degradation, proving the data-pipeline asset actually made it into the bundle.
  const starCount = Number(await page.locator('#scene').getAttribute('data-star-count'))
  expect(starCount).toBeGreaterThan(5000)

  // Display toggles live behind the dock's "Display" sheet — open it before interacting.
  await page.locator('.hud-dock-btn[data-panel="display"]').click()

  const toggle = page.locator('#starfield-toggle')
  await expect(toggle).toBeChecked()
  await toggle.uncheck()
  await expect(page.locator('#scene')).toHaveAttribute('data-starfield', 'false')

  expect(errors).toEqual([])
})
