import { expect, test } from '@playwright/test'
import { openApp } from './support/appBoot'
import { goTo } from './support/hud'

test('gas giants render their translucent cloud shell without WebGPU errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await openApp(page)

  await goTo(page, 'Jupiter')
  await page.waitForTimeout(2000)

  expect(errors).toEqual([])
})
