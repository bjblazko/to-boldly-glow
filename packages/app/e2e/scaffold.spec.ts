import { expect, test } from '@playwright/test'

test('app boots, WebGPU is available, and no page errors occur', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.locator('#scene')).toBeAttached()

  const hasWebGpu = await page.evaluate(() => 'gpu' in navigator)
  expect(hasWebGpu).toBe(true)

  // Give the async main() a moment to initialize the device and submit a frame.
  await page.waitForTimeout(500)
  expect(errors).toEqual([])
})
