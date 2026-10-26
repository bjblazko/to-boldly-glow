import { expect, test } from '@playwright/test'
import { openApp, waitForFirstFrame } from './support/appBoot'

test('the welcome card starts the narrated tour at the Sun, with the narrator; subtitles start off', async ({ page }) => {
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
  await expect(page.locator('#narration-bar')).not.toHaveAttribute('hidden')
  await expect(page.locator('#narration-subtitle')).toBeHidden()
  await expect(page.locator('#narration-subtitle')).toContainText('Welcome aboard')
  // Opus where the browser plays it (Chromium does), MP3 otherwise.
  await expect.poll(() => clips).toContain('/narration/lyra/en/sun-approach.webm')

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

test('set up the view first: the card shrinks to a Start pill, which starts the tour in that view', async ({ page }) => {
  await page.goto('/')
  await waitForFirstFrame(page)
  await page.locator('.hud-explore-dock .hud-dock-btn[data-panel="view"]').click()
  await expect(page.locator('#welcome-card')).toBeHidden()
  await page.locator('#scale-mode-realistic-btn').click()
  await page.locator('#welcome-pill-start').click()
  await expect(page.locator('#welcome-pill')).toBeHidden()
  await expect(page.locator('#camera-tour-toggle .btn-label')).toHaveText('Stop Tour')
  await expect(page.locator('#scale-mode-realistic-btn')).toHaveAttribute('aria-pressed', 'true')
})

test('the card and its pill close with their close buttons, and with Escape', async ({ page }) => {
  await page.goto('/')
  await waitForFirstFrame(page)
  await page.locator('#welcome-close').click()
  await expect(page.locator('#welcome-card')).toBeHidden()
  await expect(page.locator('#welcome-pill')).toBeHidden()

  await page.reload()
  await waitForFirstFrame(page)
  await page.locator('#scene').click({ position: { x: 40, y: 300 } })
  await page.locator('#welcome-pill-close').click()
  await expect(page.locator('#welcome-pill')).toBeHidden()

  await page.reload()
  await waitForFirstFrame(page)
  await page.keyboard.press('Escape')
  await expect(page.locator('#welcome-card')).toBeHidden()
})

test('?tour=off shows no welcome card', async ({ page }) => {
  await openApp(page)
  await expect(page.locator('#welcome-card')).toBeHidden()
})

test('subtitles and the narrator\'s voice are switched in Settings\' Audio tab, and stay so', async ({ page }) => {
  await openApp(page)
  await page.locator('#settings-btn').click()
  await page.locator('#settings-tab-audio').click()
  await expect(page.locator('#settings-audio')).toBeVisible()
  await expect(page.locator('#settings-general')).toBeHidden()
  const subtitles = page.locator('#subtitles-toggle')
  const voice = page.locator('#narration-sound-toggle')
  await expect(subtitles).not.toBeChecked()
  await expect(voice).toBeChecked()
  await subtitles.click({ force: true })
  await voice.click({ force: true })
  await page.reload()
  await waitForFirstFrame(page)
  await expect(page.locator('#subtitles-toggle')).toBeChecked()
  await expect(page.locator('#narration-sound-toggle')).not.toBeChecked()
})

test('the music is off until a track is chosen, and the choice is remembered', async ({ page }) => {
  await openApp(page)
  await page.locator('#settings-btn').click()
  await page.locator('#settings-tab-audio').click()
  const tracks = page.locator('#music-switch').getByRole('button')
  await expect(tracks).toHaveText(['Off', 'Drift', 'Nova', 'Pixel'])
  await expect(tracks.first()).toHaveAttribute('aria-pressed', 'true')
  await tracks.nth(2).click()
  await page.reload()
  await waitForFirstFrame(page)
  await expect(page.locator('#music-switch button[data-music="nova"]')).toHaveAttribute('aria-pressed', 'true')
})

test('Explore on my own turns on the orbit paths and labels', async ({ page }) => {
  await page.goto('/')
  await waitForFirstFrame(page)
  await expect(page.locator('#scene')).toHaveAttribute('data-orbit-paths', 'false')
  await page.locator('#welcome-explore').click()
  await expect(page.locator('#scene')).toHaveAttribute('data-orbit-paths', 'true')
  await expect(page.locator('#scene')).toHaveAttribute('data-labels-visible', 'true')
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
  await page.locator('#settings-tab-audio').click()
  await expect(page.locator('#settings-voice').getByRole('button', { name: 'Orion' })).toHaveAttribute('aria-pressed', 'true')
})
