import { expect, test } from '@playwright/test'

test('viewing a planet near-pole-on renders without WebGPU errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-rendered', 'true')

  await page.locator('.hud-dock-btn[data-panel="camera"]').click()
  await page.locator('#entity-search-input').fill('Saturn')
  await page.locator('#entity-search-input').press('Enter')
  await page.waitForTimeout(2000) // let the fly-to tween settle

  // Drag to a near-polar viewing angle (large vertical drag), where the pole-fade shader path is
  // actually exercised — this is a regression check for the WGSL change (uniform-layout/bind-group
  // correctness via pageerror), not a pixel-level "is it actually smoother" check.
  const canvas = page.locator('#scene')
  const box = await canvas.boundingBox()
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 3)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.9, { steps: 10 })
    await page.mouse.up()
  }
  await page.waitForTimeout(500)

  expect(errors).toEqual([])
})
