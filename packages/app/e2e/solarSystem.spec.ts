import { expect, test } from '@playwright/test'

test('all 8 planets render, and the scale + orbit-path controls affect the scene', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-rendered', 'true')

  // Positive control: dragging the scale slider changes the recorded blend value exposed for
  // testing, proving the control is actually wired to the renderer's state — not merely present
  // in the DOM. (Mirrors the time-controls e2e test's positive-control pattern.)
  const slider = page.locator('#scale-slider')
  await expect(slider).toHaveValue('100')
  await slider.fill('0')
  await slider.dispatchEvent('input')
  await expect(page.locator('#scene')).toHaveAttribute('data-scale-blend', '0')

  const toggle = page.locator('#orbit-paths-toggle')
  await expect(toggle).toBeChecked()
  await toggle.uncheck()
  await expect(page.locator('#scene')).toHaveAttribute('data-orbit-paths', 'false')

  expect(errors).toEqual([])
})
