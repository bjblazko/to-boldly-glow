import { expect, test } from '@playwright/test'

test('body labels show each name and can be toggled off', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-rendered', 'true')

  const labels = page.locator('#body-labels .body-label')
  await expect(labels).toHaveCount(9) // Sun + 8 planets
  await expect(page.locator('#body-labels .body-label', { hasText: 'Sun' })).toBeVisible()
  await expect(page.locator('#body-labels .body-label', { hasText: 'Earth' })).toBeVisible()
  await expect(page.locator('#body-labels .body-label', { hasText: 'Neptune' })).toBeAttached()

  // Positive control: unchecking the toggle actually hides the labels container, not just the
  // checkbox's own visual state. (Mirrors the scale-slider/orbit-paths positive-control pattern
  // in solarSystem.spec.ts.)
  const toggle = page.locator('#body-labels-toggle')
  await expect(toggle).toBeChecked()
  await expect(page.locator('#body-labels')).toBeVisible()
  await toggle.uncheck()
  await expect(page.locator('#scene')).toHaveAttribute('data-labels-visible', 'false')
  await expect(page.locator('#body-labels')).toBeHidden()

  expect(errors).toEqual([])
})
