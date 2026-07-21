import { expect, test } from '@playwright/test'

test('rendering with the grown lit-body uniform struct produces no WebGPU errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-rendered', 'true')

  // Every body (including ones with no bumpMapUrl yet, which is all of them until Task 5+) renders
  // through the new binding/uniform layout every frame — a few seconds of normal rendering exercises
  // it thoroughly. A bind-group-layout or uniform-struct-size mismatch surfaces as a pageerror via
  // the uncapturederror listener in renderer/webgpu.ts.
  await page.waitForTimeout(2000)

  expect(errors).toEqual([])
})
