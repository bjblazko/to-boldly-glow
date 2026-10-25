import { expect, test } from '@playwright/test'
import { openApp, waitForFirstFrame } from './support/appBoot'

test('?lang=de shows the interface, the bodies and the lessons in German', async ({ page }) => {
  await page.goto('/?tour=off&lang=de')
  await waitForFirstFrame(page)
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await expect(page.locator('#learn-mode-btn')).toHaveText('Lernen')
  await expect(page.locator('.hud-explore-dock [data-panel="time"]')).toHaveText('Zeit')
  await expect(page.locator('#palette-btn')).toHaveAttribute('aria-label', 'Alles durchsuchen')

  await page.locator('.hud-explore-dock [data-panel="find"]').click()
  await expect(page.locator('#entity-tree')).toContainText('Planeten')
  await page.locator('#entity-search-input').fill('Erde')
  await expect(page.locator('#entity-tree')).toContainText('Erde')

  await page.locator('#learn-mode-btn').click()
  await expect(page.locator('#lesson-library')).toContainText('Warum hat die Erde Jahreszeiten?')
})

test('the language picked in the settings is remembered and wins over the browser', async ({ page }) => {
  await openApp(page)
  await expect(page.locator('#learn-mode-btn')).toHaveText('Learn')
  await page.locator('#settings-btn').click()
  await page.locator('#language-switch').getByRole('button', { name: 'Deutsch' }).click()
  await waitForFirstFrame(page)
  await expect(page.locator('#learn-mode-btn')).toHaveText('Lernen')
  await page.locator('#settings-btn').click()
  await expect(page.locator('#language-switch').getByRole('button', { name: 'Deutsch' })).toHaveAttribute('aria-pressed', 'true')

  await page.goto('/?tour=off')
  await waitForFirstFrame(page)
  await expect(page.locator('#learn-mode-btn')).toHaveText('Lernen')
})
