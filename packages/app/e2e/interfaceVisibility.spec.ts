import { expect, test, type Page } from '@playwright/test'
import { openApp } from './support/appBoot'
import { openLesson } from './support/hud'

const dock = (page: Page) => page.locator('.hud-explore-dock')
const showButton = (page: Page) => page.locator('#show-ui-btn')

test('the hide button leaves only the scene and the show button, which brings everything back', async ({ page }) => {
  await openApp(page)
  await page.locator('#hide-ui-btn').click()

  await expect(dock(page)).toBeHidden()
  await expect(page.locator('.hud-modes')).toBeHidden()
  await expect(page.locator('.hud-top-actions')).toBeHidden()
  await expect(showButton(page)).toBeVisible()
  await expect(showButton(page)).toBeFocused()

  await showButton(page).click()
  await expect(dock(page)).toBeVisible()
  await expect(showButton(page)).toBeHidden()
  await expect(page.locator('#hide-ui-btn')).toBeFocused()
})

test('H hides and shows the interface, Escape shows it', async ({ page }) => {
  await openApp(page)
  await page.keyboard.press('h')
  await expect(dock(page)).toBeHidden()
  await page.keyboard.press('h')
  await expect(dock(page)).toBeVisible()

  await page.keyboard.press('h')
  await expect(dock(page)).toBeHidden()
  await page.keyboard.press('Escape')
  await expect(dock(page)).toBeVisible()
})

test('an open panel comes back as it was', async ({ page }) => {
  await openApp(page)
  await page.locator('.hud-explore-dock .hud-dock-btn[data-panel="view"]').click()
  await page.locator('#hide-ui-btn').click()
  await expect(page.locator('#hud-sheet')).toBeHidden()
  await page.keyboard.press('h')
  await expect(page.locator('.hud-sheet-panel[data-panel="view"]')).toBeVisible()
})

test('typing an h into the search does not hide anything', async ({ page }) => {
  await openApp(page)
  await page.locator('.hud-dock-btn[data-panel="find"]').click()
  await page.locator('#entity-search-input').pressSequentially('earth')
  await expect(dock(page)).toBeVisible()
  await expect(page.locator('#entity-search-input')).toHaveValue('earth')
})

test('Ctrl+K with the interface hidden brings it back with the palette open', async ({ page }) => {
  await openApp(page)
  await page.keyboard.press('h')
  await expect(dock(page)).toBeHidden()
  await page.keyboard.press('Control+k')
  await expect(page.locator('#command-palette')).toBeVisible()
  await expect(dock(page)).toBeVisible()
})

test('the palette can hide the interface', async ({ page }) => {
  await openApp(page)
  await page.keyboard.press('Control+k')
  await page.locator('#palette-input').pressSequentially('Hide interface')
  await page.locator('#palette-input').press('Enter')
  await expect(dock(page)).toBeHidden()
  await expect(showButton(page)).toBeVisible()
})

test('in Learn mode there is no hide button, and H does nothing', async ({ page }) => {
  await openApp(page)
  await openLesson(page, 'seasons')
  await expect(page.locator('#hide-ui-btn')).toBeHidden()
  await page.keyboard.press('h')
  await expect(page.locator('.hud-modes')).toBeVisible()
  await expect(showButton(page)).toBeHidden()
})

test('the beta note stays in the top left corner, also with the interface hidden', async ({ page }) => {
  await openApp(page)
  const note = page.locator('.hud-beta-note')
  await expect(note).toHaveText('Beta version')
  await page.keyboard.press('h')
  await expect(note).toBeVisible()
  const box = await note.boundingBox()
  expect(box?.x).toBeLessThan(40)
  expect(box?.y).toBeLessThan(40)
})

test('the FPS counter is off by default and shows frames per second once switched on', async ({ page }) => {
  await openApp(page)
  const fps = page.locator('#fps-display')
  await expect(fps).toBeHidden()
  await page.locator('#settings-btn').click()
  await page.locator('label:has(#fps-toggle)').click()
  await expect(fps).toBeVisible()
  await expect(fps).toHaveText(/^\d+ fps$/)
})
