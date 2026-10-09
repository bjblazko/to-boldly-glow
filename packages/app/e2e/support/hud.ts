import type { Page } from '@playwright/test'

// Opens a lesson from the library, which the Learn switch opens.
export async function openLesson(page: Page, lessonId: string): Promise<void> {
  await page.locator('#learn-mode-btn').click()
  await page.locator(`.hud-lesson-card[data-lesson-id="${lessonId}"]`).click()
}

// Back to exploring: the Explore switch ends the lesson.
export async function exitLesson(page: Page): Promise<void> {
  await page.locator('#explore-mode-btn').click()
}
