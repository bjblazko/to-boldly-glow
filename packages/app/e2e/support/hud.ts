import type { Page } from '@playwright/test'

// Opens a lesson from the start page, which the bar's Start button opens.
export async function openLesson(page: Page, lessonId: string): Promise<void> {
  await page.locator('#start-btn').click()
  await page.locator(`.hud-lesson-card[data-lesson-id="${lessonId}"]`).click()
}

// Back to exploring: the bar's Leave ends the lesson.
export async function exitLesson(page: Page): Promise<void> {
  await page.locator('#leave-btn').click()
}

// The narrated grand tour, from the start page.
export async function startGrandTour(page: Page): Promise<void> {
  await page.locator('#start-btn').click()
  await page.locator('#start-grand').click()
}

// Flies to a body (and follows it) through the search-everything palette.
export async function goTo(page: Page, name: string): Promise<void> {
  await page.locator('#search-btn').click()
  await page.locator('#palette-input').fill(name)
  await page.locator('#palette-input').press('Enter')
}
