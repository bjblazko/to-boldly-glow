import { expect, test } from '@playwright/test'

test('pausing the clock stops the time display from advancing', async ({ page }) => {
  await page.goto('/')

  // Wait for main() to finish booting (see scaffold.spec.ts) so the clock and UI are wired up.
  await expect(page.locator('#scene')).toHaveAttribute('data-rendered', 'true')

  await page.locator('#time-play-pause').click()
  await expect(page.locator('#time-play-pause')).toHaveText('Play')

  const firstReading = await page.locator('#time-display').textContent()
  await page.waitForTimeout(400)
  const secondReading = await page.locator('#time-display').textContent()

  expect(secondReading).toBe(firstReading)
})
