import type { DockUI } from '../hud/dockUI'
import type { ModeButtons } from '../hud/modeButtons'
import type { LearnUi } from '../learn/learnUi'
import type { MissionNarration } from '../missions/missionNarration'
import { MissionTourSession } from '../missions/missionTourSession'
import { MissionTourUi } from '../missions/missionTourUi'
import type { ModelContext } from '../spacecraft/modelRenderer'
import { TourUi } from '../tours/tourUi'
import { VoyagerLabels } from '../learn/voyager/voyagerLabels'
import { requireElement } from './dom'
import type { createExplorer } from './explorer'

type Explorer = ReturnType<typeof createExplorer>

export interface MissionTours {
  session: MissionTourSession
  // Who hears when a mission tour starts (true) and ends (false).
  activeChanged: ((active: boolean) => void)[]
}

// The mission tours (Voyager 1 and 2): their session, with the camera and display it borrows.
export function createMissionTours(explorer: Explorer, gpu: { device: GPUDevice; linePipeline: GPURenderPipeline; models: ModelContext }, narration: MissionNarration): MissionTours {
  const activeChanged: ((active: boolean) => void)[] = []
  const session = new MissionTourSession({
    camera: explorer.camera,
    lens: explorer.lens,
    display: explorer.display,
    gpu,
    ui: new MissionTourUi(requireElement),
    narration,
    labels: new VoyagerLabels(requireElement('#mission-labels'), null),
    activeChanged: (active) => activeChanged.forEach((listener) => listener(active)),
  })
  return { session, activeChanged }
}

// The Tours mode: the narrated grand tour and the mission tours, from the top switch's Tours button.
// Starting one ends the other; Explore or Learn ends either.
export function createTours(explorer: Explorer, { learnUi, dock, missions }: { learnUi: LearnUi; dock: DockUI; missions: MissionTours }, modes: ModeButtons): void {
  const elements = {
    exploreButton: requireElement<HTMLButtonElement>('#explore-mode-btn'),
    learnButton: requireElement<HTMLButtonElement>('#learn-mode-btn'),
    toursButton: requireElement<HTMLButtonElement>('#tours-mode-btn'),
    library: { dialog: requireElement('#tour-library'), list: requireElement('#tour-library-list'), closeButton: requireElement<HTMLButtonElement>('#tour-library-close') },
  }
  const actions = {
    closeOtherMenus: () => {
      learnUi.hideLibrary()
      dock.closeActivePanel()
    },
    leaveLesson: () => learnUi.explore(),
    startTour: (tour: 'grand' | 'voyager1' | 'voyager2') => {
      if (tour === 'grand') {
        missions.session.stop()
        explorer.startNarratedTour()
      } else {
        explorer.camera.stopTour()
        void missions.session.start(tour)
      }
    },
    stopTour: () => {
      explorer.camera.stopTour()
      missions.session.stop()
    },
  }
  const tours = new TourUi(elements, actions, modes)
  explorer.narratedTourChanged.push((flying) => tours.narratedTourChanged(flying))
  missions.activeChanged.push((active) => tours.narratedTourChanged(active))
  elements.learnButton.addEventListener('click', () => missions.session.stop())
}
