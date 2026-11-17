import { expect, test } from '@playwright/test'
import { openApp, waitForFirstFrame } from './support/appBoot'

test('?lang=de shows the interface, the bodies and the lessons in German', async ({ page }) => {
  await page.goto('/?tour=off&lang=de')
  await waitForFirstFrame(page)
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await expect(page.locator('#search-btn')).toHaveText('Suchen')
  await expect(page.locator('.hud-bar [data-panel="time"]:visible')).toHaveText('Zeit')
  await expect(page.locator('#search-btn')).toHaveAttribute('title', 'Alles durchsuchen (Strg+K)')

  await page.locator('#search-btn').click()
  await page.locator('#palette-input').fill('Erde')
  await expect(page.locator('#palette-results')).toContainText('Planet')
  await page.keyboard.press('Escape')

  await page.locator('#start-btn').click()
  await expect(page.locator('#start-page')).toContainText('Warum hat die Erde Jahreszeiten?')
})

test('the language picked in the settings is remembered and wins over the browser', async ({ page }) => {
  await openApp(page)
  await expect(page.locator('#search-btn')).toHaveText('Search')
  await page.locator('#settings-btn').click()
  await page.locator('#language-switch').getByRole('button', { name: 'Deutsch' }).click()
  await waitForFirstFrame(page)
  await expect(page.locator('#search-btn')).toHaveText('Suchen')
  await page.locator('#settings-btn').click()
  await expect(page.locator('#language-switch').getByRole('button', { name: 'Deutsch' })).toHaveAttribute('aria-pressed', 'true')

  await page.goto('/?tour=off')
  await waitForFirstFrame(page)
  await expect(page.locator('#search-btn')).toHaveText('Suchen')
})
