import { expect, test } from '@playwright/test'

test('app boots and the engine module computes the expected Julian Day', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#app')).toContainText('2451545')
})
