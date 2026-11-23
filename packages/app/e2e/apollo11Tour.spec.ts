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

test('the jog and shuttle: shown from the bar, J/K/L and the arrows drive it, the strip jumps along the whole tour', async ({ page }) => {
  await page.goto('/?tour=off#tour/apollo11/coast')
  await waitForFirstFrame(page)
  await expect(page.locator('#mission-tour .hud-mission-card')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('#mission-shuttle')).toBeHidden()
  await page.locator('#mission-shuttle-btn').click()
  await expect(page.locator('#mission-shuttle')).toBeVisible()
  await page.keyboard.press('l')
  await page.keyboard.press('l')
  await expect(page.locator('#mission-shuttle-rate')).toHaveText('▶ 2×')
  if (process.env.TOUR_SHOTS) await page.screenshot({ path: `${process.env.TOUR_SHOTS}/shuttle.png` })
  await page.keyboard.press('k')
  await expect(page.locator('#mission-shuttle-rate')).toHaveText('')
  const before = await page.locator('#mission-shuttle-timecode').textContent()
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('#mission-shuttle-timecode')).not.toHaveText(before!)
  const strip = (await page.locator('#mission-shuttle-overview').boundingBox())!
  await page.mouse.click(strip.x + strip.width * 0.97, strip.y + strip.height / 2)
  await expect.poll(() => new URL(page.url()).hash).toBe('#tour/apollo11/entry')
  await page.locator('#mission-shuttle-btn').click()
  await expect(page.locator('#mission-shuttle')).toBeHidden()
})
