import { expect, test } from '@playwright/test'

test('body textures load without error and the scene renders once they settle', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.locator('#scene')).toHaveAttribute('data-rendered', 'true')

  // Positive control: `data-textures-loaded` is only set once every body's texture-load promise
  // (success or graceful fallback) has settled, proving the async texture pipeline actually ran
  // rather than the test racing ahead of it.
  await expect(page.locator('#scene')).toHaveAttribute('data-textures-loaded', 'true')

  expect(errors).toEqual([])
})
