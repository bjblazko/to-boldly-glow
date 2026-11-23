import { expect, test } from '@playwright/test'
import { waitForFirstFrame } from './support/appBoot'

test('a link opens the Apollo 11 tour at its station, the address follows it, and leaving gives the view back', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await page.goto('/?tour=off#tour/apollo11/landing')
  await waitForFirstFrame(page)
  await expect(page.locator('#mission-tour .hud-mission-card')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('#mission-card-title')).toHaveText(/landing|Landung/i)
  await expect(page.locator('body')).toHaveAttribute('data-mission-tour', 'apollo11')
  await page.waitForTimeout(3000)
  if (process.env.TOUR_SHOTS) await page.screenshot({ path: `${process.env.TOUR_SHOTS}/landing.png` })
  await page.locator('#mission-next').click()
  await expect.poll(() => new URL(page.url()).hash).toBe('#tour/apollo11/firstStep')
  await page.keyboard.press('Escape')
  await expect(page.locator('#mission-tour .hud-mission-card')).toBeHidden()
  await expect.poll(() => new URL(page.url()).hash).toBe('')
  // Software WebGPU (headless) cannot copy some model textures; the models fall back to flat shading.
  expect(errors.filter((text) => !/favicon|Invalid Texture|copy content from external image/.test(text))).toEqual([])
})
