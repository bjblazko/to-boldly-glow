import { expect, test, type Page } from '@playwright/test'
import { waitForFirstFrame } from './support/appBoot'

// The tour loads much (its models, the terrain, the Moon's region): on software WebGPU (CI) it takes
// a while. What the page says on the way is printed, for a run that fails.
test.setTimeout(90_000)
function listen(page: Page): string[] {
  const t0 = Date.now()
  const log: string[] = []
  page.on('console', (m) => {
    if (!/Texture load failed|copy content|\[vite\]/.test(m.text())) log.push(`${Date.now() - t0} ms ${m.type()}: ${m.text().slice(0, 300)}`)
  })
  page.on('pageerror', (e) => log.push(`${Date.now() - t0} ms pageerror: ${e.message.slice(0, 300)}`))
  return log
}

async function openTour(page: Page, link: string, log: string[]): Promise<void> {
  const t0 = Date.now()
  await page.goto(link)
  await waitForFirstFrame(page)
  try {
    await expect(page.locator('#mission-tour .hud-mission-card')).toBeVisible({ timeout: 75_000 })
  } catch (error) {
    console.log(`The tour did not open (${Date.now() - t0} ms). The page said:\n${log.join('\n')}`)
    throw error
  }
  console.log(`The tour opened after ${Date.now() - t0} ms.`)
}

test('a link opens the Apollo 11 tour at its station, the address follows it, and leaving gives the view back', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await openTour(page, '/?tour=off#tour/apollo11/landing', listen(page))
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
  await openTour(page, '/?tour=off#tour/apollo11/coast', listen(page))
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
