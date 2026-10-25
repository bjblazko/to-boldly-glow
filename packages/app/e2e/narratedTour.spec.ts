import { expect, test } from '@playwright/test'
import { openApp, waitForFirstFrame } from './support/appBoot'

test('the welcome card starts the narrated tour at the Sun, with the narrator and subtitles', async ({ page }) => {
  const clips: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/narration/')) clips.push(new URL(request.url()).pathname)
  })
  await page.goto('/')
  await waitForFirstFrame(page)
  const card = page.locator('#welcome-card')
  await expect(card).toBeVisible()
  await expect(card.locator('#welcome-language').getByRole('button')).toHaveText(['English', 'Deutsch'])
  await expect(card.locator('#welcome-voice').getByRole('button')).toHaveText(['Lyra', 'Orion'])

  await card.locator('#welcome-start').click()
  await expect(card).toBeHidden()
  await expect(page.locator('#camera-tour-toggle .btn-label')).toHaveText('Stop Tour')
  await expect(page.locator('#narration-bar')).toBeVisible()
  await expect(page.locator('#narration-subtitle')).toContainText('Welcome aboard')
  // Opus where the browser plays it (Chromium does), MP3 otherwise.
  await expect.poll(() => clips).toContain('/narration/lyra/en/sun-approach.webm')

  await page.locator('#narration-mute').click()
  await expect(page.locator('#narration-mute')).toHaveAttribute('aria-pressed', 'true')

  // Any manual camera input hands control back and silences the narrator.
  await page.locator('#scene').click({ position: { x: 40, y: 300 } })
  await expect(page.locator('#camera-tour-toggle .btn-label')).toHaveText('Start Tour')
  await expect(page.locator('#narration-bar')).toBeHidden()
})

test('the narrator speaks German in German', async ({ page }) => {
  await page.goto('/?lang=de')
  await waitForFirstFrame(page)
  await page.locator('#welcome-start').click()
  await expect(page.locator('#narration-subtitle')).toContainText('Willkommen an Bord')
})

test('left alone, the welcome card steps aside for the silent tour', async ({ page }) => {
  await page.goto('/')
  await waitForFirstFrame(page)
  await expect(page.locator('#welcome-card')).toBeVisible()
  await expect(page.locator('#camera-tour-toggle .btn-label')).toHaveText('Stop Tour', { timeout: 15_000 })
  await expect(page.locator('#welcome-card')).toBeHidden()
  await expect(page.locator('#narration-bar')).toBeHidden()
})

test('?tour=off shows no welcome card', async ({ page }) => {
  await openApp(page)
  await expect(page.locator('#welcome-card')).toBeHidden()
})

test('subtitles can be switched off in Settings, and stay off', async ({ page }) => {
  await openApp(page)
  await page.locator('#settings-btn').click()
  const toggle = page.locator('#subtitles-toggle')
  await expect(toggle).toBeChecked()
  await toggle.click({ force: true })
  await page.reload()
  await waitForFirstFrame(page)
  await expect(page.locator('#subtitles-toggle')).not.toBeChecked()
})

test('the narrator picked on the welcome card speaks, and Settings shows the same choice', async ({ page }) => {
  const clips: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/narration/')) clips.push(new URL(request.url()).pathname)
  })
  await page.goto('/')
  await waitForFirstFrame(page)
  await page.locator('#welcome-voice').getByRole('button', { name: 'Orion' }).click()
  await page.locator('#welcome-start').click()
  await expect.poll(() => clips).toContain('/narration/orion/en/sun-approach.webm')
  await page.locator('#settings-btn').click()
  await expect(page.locator('#settings-voice').getByRole('button', { name: 'Orion' })).toHaveAttribute('aria-pressed', 'true')
})
