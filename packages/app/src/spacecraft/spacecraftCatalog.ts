import type { AuPosition } from '../solarSystem/sceneScale'
import { Trajectory } from './trajectory'

// The spacecraft the explore view shows and the search finds, each on its real trajectory (JPL
// Horizons, bundled - see packages/data-pipeline/src/fetchVoyagerTrajectories.ts).
export interface SpacecraftDefinition {
  id: string
  name: string
  // Half its longest extent (Voyager: the 13 m magnetometer boom), and how big it is drawn at Compact
  // scale (scene units) - like a body's radiusKm and compactVisualRadius.
  radiusKm: number
  compactVisualRadius: number
  trajectoryUrl: string
}

export const SPACECRAFT: SpacecraftDefinition[] = [
  { id: 'voyager1', name: 'Voyager 1', radiusKm: 0.0075, compactVisualRadius: 0.6, trajectoryUrl: 'data/voyager/voyager1.trajectory.bin' },
  { id: 'voyager2', name: 'Voyager 2', radiusKm: 0.0075, compactVisualRadius: 0.6, trajectoryUrl: 'data/voyager/voyager2.trajectory.bin' },
]

// The trajectories, once loaded at start-up (a few kB). Until then a spacecraft has no position;
// before launch it waits where its path begins (at Earth), after the data ends where it ends.
const trajectories = new Map<string, Trajectory>()

export async function loadSpacecraftTrajectories(): Promise<void> {
  const loaded = await Promise.all(SPACECRAFT.map(async (craft) => [craft.id, await Trajectory.load(craft.trajectoryUrl)] as const))
  for (const [id, trajectory] of loaded) trajectories.set(id, trajectory)
}

export function spacecraftAuPosition(id: string, daysSinceEpoch: number): AuPosition | null {
  return trajectories.get(id)?.positionAt(daysSinceEpoch) ?? null
}

// Whether it is on its way on that day (launched, and within the data): only then is it shown.
export function spacecraftInFlight(id: string, daysSinceEpoch: number): boolean {
  const trajectory = trajectories.get(id)
  return trajectory !== undefined && daysSinceEpoch >= trajectory.firstDay && daysSinceEpoch <= trajectory.lastDay
}

// For tests: a trajectory read from its file directly.
export function setSpacecraftTrajectory(id: string, trajectory: Trajectory): void {
  trajectories.set(id, trajectory)
}
