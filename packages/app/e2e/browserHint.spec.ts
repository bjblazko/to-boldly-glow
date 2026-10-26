import { expect, test } from '@playwright/test'
import { openApp } from './support/appBoot'

test('a Chrome-based browser gets no browser hint', async ({ page }) => {
  await openApp(page)
  await expect(page.locator('#browser-hint')).toBeHidden()
})

test.describe('in a browser that says it is Firefox', () => {
  test.use({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:155.0) Gecko/20100101 Firefox/155.0' })

  test('the hint recommends a Chrome-based browser, and once closed stays closed', async ({ page }) => {
    // Client hints still name Chromium in the test browser: take them away, as Firefox has none.
    await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'userAgentData', { get: () => undefined }))
    await openApp(page)
    const hint = page.locator('#browser-hint')
    await expect(hint).toBeVisible()
    await expect(hint).toContainText('Chrome-based browser')
    await page.locator('#browser-hint-close').click()
    await expect(hint).toBeHidden()
    await page.reload()
    await expect(page.locator('#scene')).toHaveAttribute('data-rendered', 'true', { timeout: 30_000 })
    await expect(hint).toBeHidden()
  })
})
