import { expect, test } from '@playwright/test'
import { openApp } from './support/appBoot'

test('the info button opens the About dialog with the maker, the links and the licenses', async ({ page, request }) => {
  await openApp(page)
  await page.locator('#about-btn').click()
  const dialog = page.locator('#about-dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Timo Böwing')
  await expect(dialog.getByRole('link', { name: 'Project page' })).toHaveAttribute('href', 'https://huepattl.de/products/to-boldly-glow')
  await expect(dialog.getByRole('link', { name: 'Source code on GitHub' })).toHaveAttribute('href', 'https://github.com/bjblazko/to-boldly-glow')
  await expect(dialog.getByRole('link', { name: 'Imprint' })).toBeVisible()
  await expect(dialog.locator('.hud-credits li', { hasText: 'gl-matrix' })).toBeVisible()

  // Every shipped license text the dialog links to is really there.
  const texts = await dialog.locator('a[href^="licenses/"]').evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).href))
  expect(texts.length).toBeGreaterThan(5)
  for (const url of texts) expect((await request.get(url)).status(), url).toBe(200)

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(page.locator('#about-btn')).toBeFocused()
})

test('while the About dialog is open, H does not hide the interface', async ({ page }) => {
  await openApp(page)
  await page.locator('#about-btn').click()
  await page.keyboard.press('h')
  await page.keyboard.press('Escape')
  await expect(page.locator('#about-dialog')).toBeHidden()
  await expect(page.locator('.hud-explore-dock')).toBeVisible()
})

test('the palette opens the About dialog', async ({ page }) => {
  await openApp(page)
  await page.keyboard.press('Control+k')
  await page.locator('#palette-input').pressSequentially('imprint')
  await page.locator('#palette-input').press('Enter')
  await expect(page.locator('#about-dialog')).toBeVisible()
})

test('the About dialog shows the app’s version', async ({ page }) => {
  await openApp(page)
  await page.locator('#about-btn').click()
  await expect(page.locator('#about-version')).toHaveText(/^Version \d+\.\d+\.\d+$/)
})
