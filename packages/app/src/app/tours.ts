import type { LearnUi } from '../learn/learnUi'
import type { MissionNarration } from '../missions/missionNarration'
import { MissionTourSession } from '../missions/missionTourSession'
import { MissionTourUi } from '../missions/missionTourUi'
import type { ModelContext } from '../spacecraft/modelRenderer'
import type { TourId } from '../tours/tourLibrary'
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

export interface Tours {
  // `partIndex`: a stop or station to start at (a link into the tour).
  start: (tour: TourId, partIndex?: number | null) => void
  // Ends whichever tour flies.
  stopAll: () => void
}

// The narrated grand tour and the mission tours. Starting one ends the other, and a lesson.
export function createTours(explorer: Explorer, { learnUi, missions }: { learnUi: LearnUi; missions: MissionTours }): Tours {
  const stopAll = () => {
    explorer.camera.stopTour()
    missions.session.stop()
  }
  const start = (tour: TourId, partIndex: number | null = null) => {
    learnUi.explore()
    stopAll()
    if (tour === 'grand') explorer.startNarratedTour(partIndex)
    // The Apollo 11 tour's own session comes with its scene (plan 2026-11-23, task 5).
    else if (tour !== 'apollo11') void missions.session.start(tour, partIndex)
  }
  return { start, stopAll }
}
