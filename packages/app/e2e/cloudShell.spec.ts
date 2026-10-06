import { expect, test } from '@playwright/test'
import { openApp } from './support/appBoot'

test('gas giants render their translucent cloud shell without WebGPU errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await openApp(page)

  await page.locator('.hud-dock-btn[data-panel="camera"]').click()
  await page.locator('#entity-search-input').fill('Jupiter')
  await page.locator('#entity-search-input').press('Enter')
  await page.waitForTimeout(2000)

  expect(errors).toEqual([])
})
