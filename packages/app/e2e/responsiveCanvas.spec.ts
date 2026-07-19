import { expect, test } from '@playwright/test'

test('canvas fills the window and resizes its backing store with it', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.setViewportSize({ width: 1000, height: 700 })
  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-rendered', 'true')

  // Positive control: the canvas's actual WebGPU backing-store size (not just its CSS display
  // size) matches the viewport, proving it isn't still the old fixed 800x600 stretched by CSS.
  const initialSize = await page
    .locator('#scene')
    .evaluate((el: HTMLCanvasElement) => ({ width: el.width, height: el.height }))
  expect(initialSize.width).toBeGreaterThanOrEqual(990)
  expect(initialSize.height).toBeGreaterThanOrEqual(690)

  await page.setViewportSize({ width: 500, height: 400 })
  await page.waitForFunction(
    (previousWidth) => (document.querySelector('#scene') as HTMLCanvasElement).width < previousWidth,
    initialSize.width,
  )

  const resizedSize = await page
    .locator('#scene')
    .evaluate((el: HTMLCanvasElement) => ({ width: el.width, height: el.height }))
  expect(resizedSize.width).toBeLessThan(initialSize.width)
  expect(resizedSize.height).toBeLessThan(initialSize.height)
  expect(resizedSize.width).toBeGreaterThanOrEqual(490)
  expect(resizedSize.height).toBeGreaterThanOrEqual(390)

  expect(errors).toEqual([])
})
