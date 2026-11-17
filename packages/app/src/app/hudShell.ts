import { AboutDialog } from '../about/aboutDialog'
import type { BarContext, BarContextView } from '../hud/barContext'
import { CommandPalette } from '../hud/commandPalette'
import type { DockUI } from '../hud/dockUI'
import { InterfaceVisibility } from '../hud/interfaceVisibility'
import { bindLanguageSwitch } from '../hud/languageSwitch'
import { bindSettingsTabs, SettingsPanel } from '../hud/settingsPanel'
import { StartPage } from '../hud/startPage'
import { msg } from '../i18n/i18n'
import type { LearnUi } from '../learn/learnUi'
import { LessonLibrary } from '../learn/lessonLibrary'
import type { LessonProgress } from '../learn/lessonProgress'
import { LESSON_TOPICS } from '../learn/lessons/lessonCatalog'
import { bindVoiceSwitch } from '../narration/narratorVoice'
import { renderTourCards } from '../tours/tourLibrary'
import { requireElement } from './dom'
import type { createExplorer } from './explorer'
import { gatherPaletteItems } from './paletteItems'
import { markStartPageSeen, startPageSeen, startPageWanted } from './startupTour'
import type { Tours } from './tours'

type Explorer = ReturnType<typeof createExplorer>

export interface HudParts {
  learnUi: LearnUi
  progress: LessonProgress
  dock: DockUI
  tours: Tours
  bar: BarContextView
}

// Everything around the bar: the start page with its tours and lessons, Leave, More (settings,
// About, the controls, hiding the interface), the beta chip and the search-everything palette.
// Returns what the first frame does: open the start page on a first visit.
export function createHud(explorer: Explorer, parts: HudParts): { firstFrame: () => void } {
  const more = createMore()
  const ui = new InterfaceVisibility(document.body, { hide: requireElement('#hide-ui-btn'), show: requireElement('#show-ui-btn'), returnFocus: requireElement('#settings-btn') })
  const about = createAbout()
  const start = createStartPage(explorer, parts, () => more.setOpen(false))
  bindLeave(parts)
  // Choosing something in More closes it.
  for (const id of ['#controls-help', '#about-btn', '#hide-ui-btn']) requireElement(id).addEventListener('click', () => more.setOpen(false))
  requireElement('#beta-chip').addEventListener('click', () => about.open())
  explorer.canvas.addEventListener('pointerdown', () => parts.dock.closeActivePanel())
  createPalette(explorer, parts, { hideInterface: () => ui.hide(), showAbout: () => about.open() })
  return {
    firstFrame: () => {
      if (!startPageWanted(window.location.search, startPageSeen())) return
      markStartPageSeen()
      start.open()
    },
  }
}

function createStartPage(explorer: Explorer, { learnUi, progress, dock, tours }: HudParts, closeMore: () => void): StartPage {
  const lessons = new LessonLibrary({ topics: requireElement('#library-topics'), search: requireElement<HTMLInputElement>('#library-search') }, LESSON_TOPICS, progress, {
    onPick: (lesson) => start.pick(() => {
      tours.stopAll()
      learnUi.openLesson(lesson)
    }),
  })
  const start: StartPage = new StartPage(
    {
      dialog: requireElement('#start-page'),
      opener: requireElement<HTMLButtonElement>('#start-btn'),
      close: requireElement<HTMLButtonElement>('#start-close'),
      grand: requireElement<HTMLButtonElement>('#start-grand'),
      explore: requireElement<HTMLButtonElement>('#start-explore'),
      language: requireElement('#start-language'),
      voice: requireElement('#start-voice'),
    },
    {
      startGrandTour: () => tours.start('grand'),
      exploreOnOwn: () => {
        tours.stopAll()
        learnUi.explore()
        explorer.display.orbitPaths.set(true)
        explorer.display.bodyLabels.set(true)
      },
      opening: () => {
        dock.closeActivePanel()
        closeMore()
        lessons.reset()
      },
    },
  )
  renderTourCards(requireElement('#tour-library-list'), (tour) => start.pick(() => tours.start(tour)))
  return start
}

// The bar's Leave: out of the lesson, or the end of the tour - its label says which.
function bindLeave({ learnUi, tours, bar }: HudParts): void {
  const label = requireElement('#leave-label')
  const labels: Record<BarContext, string> = { explore: '', lesson: msg.ui.bar.leave, mission: msg.ui.bar.endTour, tour: msg.ui.bar.endTour }
  bar.onChange((context) => (label.textContent = labels[context]))
  requireElement('#leave-btn').addEventListener('click', () => {
    if (bar.current === 'lesson') learnUi.explore()
    else tours.stopAll()
  })
}

// More: the settings in tabs (language, graphics, narrator and music), and below them the controls,
// About and hiding the interface.
function createMore(): SettingsPanel {
  const panel = new SettingsPanel(requireElement('#settings-panel'), requireElement('#settings-btn'), requireElement('#settings-close'))
  bindSettingsTabs(requireElement('#settings-tabs'))
  bindLanguageSwitch(requireElement('#language-switch'))
  bindVoiceSwitch(requireElement('#settings-voice'))
  return panel
}

function createAbout(): AboutDialog {
  return new AboutDialog(requireElement<HTMLDialogElement>('#about-dialog'), {
    openButton: requireElement('#about-btn'),
    closeButton: requireElement('#about-close'),
    credits: requireElement('#about-credits'),
    version: requireElement('#about-version'),
    controls: requireElement('#about-controls'),
  })
}

function createPalette(explorer: Explorer, { learnUi, tours }: HudParts, app: { hideInterface(): void; showAbout(): void }): CommandPalette {
  const elements = {
    dialog: requireElement('#command-palette'),
    input: requireElement<HTMLInputElement>('#palette-input'),
    results: requireElement('#palette-results'),
    openButton: requireElement<HTMLButtonElement>('#search-btn'),
  }
  const actions = {
    goTo: (entity: Parameters<Explorer['select']>[0]) => {
      tours.stopAll()
      learnUi.explore()
      explorer.select(entity)
    },
    openLesson: (lesson: Parameters<LearnUi['openLesson']>[0]) => {
      tours.stopAll()
      learnUi.openLesson(lesson)
    },
    startTour: tours.start,
    ...app,
  }
  return new CommandPalette(elements, () => gatherPaletteItems(actions))
}
