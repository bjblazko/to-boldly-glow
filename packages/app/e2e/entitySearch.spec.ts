import { expect, test } from '@playwright/test'
import { openApp } from './support/appBoot'

test('picking a body in the Find tree locks the camera onto it', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await openApp(page)

  await page.locator('.hud-dock-btn[data-panel="find"]').click()
  await page.locator('#entity-search-input').fill('Titan')
  await page.locator('#entity-tree .hud-tree-item[data-entity-id="titan"]').click()

  await expect(page.locator('#scene')).toHaveAttribute('data-following-id', 'titan')
  await expect(page.locator('#follow-indicator')).toBeVisible()
  await expect(page.locator('#follow-indicator-label')).toHaveText('Following: Titan')
  // The followed body is marked in the tree.
  await expect(page.locator('#entity-tree .hud-tree-item[data-entity-id="titan"]')).toHaveAttribute('aria-current', 'true')

  await page.locator('#follow-stop-button').click()
  await expect(page.locator('#scene')).not.toHaveAttribute('data-following-id')
  await expect(page.locator('#follow-indicator')).toBeHidden()

  expect(errors).toEqual([])
})

test('the Find tree groups bodies by kind, nests moons under their planet, and narrows down as you type', async ({ page }) => {
  await openApp(page)
  await page.locator('.hud-dock-btn[data-panel="find"]').click()

  const tree = page.locator('#entity-tree')
  await expect(tree.locator('.hud-tree-group')).toHaveCount(4)
  await expect(tree.locator('[data-group="planets"] > .hud-tree-list > li > .hud-tree-item')).toHaveCount(8)
  // Jupiter's four moons hang under Jupiter.
  await expect(tree.locator('li:has(> [data-entity-id="jupiter"]) .hud-tree-list .hud-tree-item')).toHaveCount(4)

  // "ti" matches Titan and Titania: their planets stay as context, everything else goes.
  await page.locator('#entity-search-input').fill('ti')
  await expect(tree.locator('.hud-tree-item')).toHaveText(['Saturn', 'Titan', 'Uranus', 'Titania'])

  // Enter flies to the first match.
  await page.locator('#entity-search-input').press('Enter')
  await expect(page.locator('#scene')).toHaveAttribute('data-following-id', 'titan')
})

test('picking a body while in fly mode forces the camera back to orbit mode', async ({ page }) => {
  await openApp(page)

  await page.locator('.hud-dock-btn[data-panel="camera"]').click()
  const modeToggle = page.locator('#camera-mode-toggle')
  await modeToggle.click()
  await expect(modeToggle).toHaveText('Switch to Orbit Camera')

  await page.locator('.hud-dock-btn[data-panel="find"]').click()
  await page.locator('#entity-search-input').fill('Mars')
  await page.locator('#entity-tree .hud-tree-item[data-entity-id="mars"]').click()

  await expect(modeToggle).toHaveText('Switch to Free-fly Camera')
  await expect(page.locator('#scene')).toHaveAttribute('data-following-id', 'mars')
})
