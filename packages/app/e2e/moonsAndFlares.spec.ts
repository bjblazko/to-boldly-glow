import { expect, test } from '@playwright/test'
import { openApp } from './support/appBoot'

test('moons and lens flares can each be toggled independently', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await openApp(page)

  // What the scene shows lives behind the dock's View sheet - open it before interacting.
  await page.locator('.hud-dock-btn[data-panel="view"]:visible').click()

  const moonsToggle = page.locator('#moons-toggle')
  await expect(moonsToggle).toBeChecked()
  await moonsToggle.uncheck()
  await expect(page.locator('#scene')).toHaveAttribute('data-moons', 'false')

  // Lens flares and bloom are rendering settings: they live in the Settings popover.
  await page.locator('#settings-btn').click()

  // A subtle flare is on by default; turn it off and back on, then off again.
  const flaresToggle = page.locator('#flares-toggle')
  await expect(flaresToggle).toBeChecked()
  await expect(page.locator('#scene')).toHaveAttribute('data-flares', 'true')
  await flaresToggle.uncheck()
  await expect(page.locator('#scene')).toHaveAttribute('data-flares', 'false')
  await flaresToggle.check()
  await expect(page.locator('#scene')).toHaveAttribute('data-flares', 'true')
  await flaresToggle.uncheck()
  await expect(page.locator('#scene')).toHaveAttribute('data-flares', 'false')

  // Turning bloom off must not affect the (now independently toggled) flares state.
  const bloomToggle = page.locator('#bloom-toggle')
  await bloomToggle.uncheck()
  await expect(page.locator('#scene')).toHaveAttribute('data-bloom', 'false')
  await expect(page.locator('#scene')).toHaveAttribute('data-flares', 'false')

  expect(errors).toEqual([])
})
