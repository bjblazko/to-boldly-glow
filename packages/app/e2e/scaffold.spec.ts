import { expect, test } from '@playwright/test'

test('app boots, WebGPU is available, and a frame actually renders', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.locator('#scene')).toBeAttached()

  const hasWebGpu = await page.evaluate(() => 'gpu' in navigator)
  expect(hasWebGpu).toBe(true)

  // Wait for main() to actually complete WebGPU init, create pipelines/bind groups,
  // and submit a frame to the GPU queue. This catches adapter-null, pipeline/bind
  // group validation failures, and shader compile errors (which fail pipeline
  // creation) — none of which surface as an uncaught pageerror, since main()
  // catches and swallows its own promise rejection.
  await expect(page.locator('#scene')).toHaveAttribute('data-rendered', 'true')

  // Secondary check: no uncaught page errors either.
  expect(errors).toEqual([])
})
