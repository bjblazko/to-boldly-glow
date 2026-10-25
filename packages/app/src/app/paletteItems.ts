import type { PaletteItem } from '../hud/commandPalette'
import type { Lesson } from '../learn/lessonTypes'
import { LESSON_TOPICS } from '../learn/lessons/lessonCatalog'
import type { MoonDefinition } from '../solarSystem/moons'
import { ALL_ENTITIES, type SolarSystemEntity } from '../solarSystem/entities'
import { msg } from '../i18n/i18n'

export interface PaletteActions {
  // Flies to the body and follows it (back in explore mode first, if a lesson runs).
  goTo(entity: SolarSystemEntity): void
  openLesson(lesson: Lesson): void
  hideInterface(): void
  showAbout(): void
}

const KIND_LABEL: Record<SolarSystemEntity['kind'], string> = msg.ui.kinds
const TEXT = msg.ui.palette

// Everything the command palette can find: every body, every lesson, and every switch and the scale
// buttons as the View and Settings panels show them right now.
export function gatherPaletteItems(actions: PaletteActions): PaletteItem[] {
  return [...objectItems(actions), ...lessonItems(actions), ...settingItems(), ...appItems(actions)]
}

function appItems(actions: PaletteActions): PaletteItem[] {
  return [
    { group: 'Settings', label: msg.ui.top.hide, detail: 'H', run: () => actions.hideInterface() },
    { group: 'Settings', label: msg.ui.top.about, detail: '', run: () => actions.showAbout() },
  ]
}

function objectItems(actions: PaletteActions): PaletteItem[] {
  return ALL_ENTITIES.map((entity) => ({ group: 'Objects', label: entity.name, detail: describeEntity(entity), run: () => actions.goTo(entity) }))
}

function describeEntity(entity: SolarSystemEntity): string {
  if (entity.kind !== 'moon') return KIND_LABEL[entity.kind]
  const parent = ALL_ENTITIES.find((candidate) => candidate.id === (entity.definition as MoonDefinition).parentId)
  return parent ? TEXT.moonOf(parent.name) : KIND_LABEL.moon
}

function lessonItems(actions: PaletteActions): PaletteItem[] {
  return LESSON_TOPICS.flatMap((topic) =>
    topic.lessons.map((lesson): PaletteItem => ({
      group: 'Lessons',
      label: lesson.title,
      detail: TEXT.lessonDetail(topic.title, lesson.chapters.length),
      run: () => actions.openLesson(lesson),
    })),
  )
}

function settingItems(): PaletteItem[] {
  const switches = Array.from(document.querySelectorAll<HTMLElement>('.hud-toggle-chip')).flatMap((chip): PaletteItem[] => {
    const input = chip.querySelector<HTMLInputElement>('input')
    const label = chip.querySelector('.hud-toggle-label')?.textContent?.trim()
    if (!input || !label) return []
    return [{ group: 'Settings', label, detail: input.checked ? TEXT.on : TEXT.off, run: () => input.click() }]
  })
  const scales = Array.from(document.querySelectorAll<HTMLButtonElement>('[id^="scale-mode-"]')).map(
    (button): PaletteItem => ({
      group: 'Settings',
      label: TEXT.scale(button.textContent?.trim() ?? ''),
      detail: button.getAttribute('aria-pressed') === 'true' ? TEXT.current : '',
      run: () => button.click(),
    }),
  )
  return [...scales, ...switches]
}
