import { expect, test } from '@playwright/test'
import { openApp } from './support/appBoot'

// Wide landscape screens: a mission tour's card is the same column standing on the bar as a
// lesson's panel - one "L", the bar's top edge ending where the column begins.
test('on a wide screen a mission tour’s card is a column 380px wide standing on the bar', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openApp(page)
  await page.locator('#start-btn').click()
  await page.locator('.hud-lesson-card[data-tour-id="voyager2"]').click()
  const card = page.locator('#mission-tour .hud-mission-card')
  await expect(card).toBeVisible()
  const column = (await card.boundingBox())!
  const bar = (await page.locator('#hud-bar').boundingBox())!
  expect(column.width).toBeCloseTo(380, 0)
  expect(column.x + column.width).toBeCloseTo(bar.x + bar.width, 0)
  expect(column.y + column.height).toBeCloseTo(bar.y, 0)
})
