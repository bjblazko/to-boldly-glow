import { AU_KM, PLANETS, SUN, type BodyDefinition } from '../../solarSystem/bodies'
import { scaledBodyRadiusUnits } from '../../solarSystem/sceneScale'
import { realOrientation, sunPose } from '../../scene/exploreLayout'
import type { PlanetPose, SceneLayout } from '../../scene/sceneLayout'
import { axisAlignmentRotation } from '../../solarSystem/poleOrientation'
import type { Vec3 } from '../../math/tuples'
import type { Ephemeris } from '../../time/ephemeris'
import type { LineupArrangement } from './lineupArrangement'
import type { PlanetTurntable } from './planetTurntable'

const GAP_UNITS = 0.015
const TRUE_SCALE = 0

export interface LineupSlot {
  x: number
  radius: number
}

// The Sun's radius in the lineup (scene units).
export const LINEUP_SUN_RADIUS = scaledBodyRadiusUnits(SUN.radiusKm, SUN.compactVisualRadius, TRUE_SCALE, AU_KM)

// The planets out from the Sun (bodies.ts lists them so): the lesson's own order.
export const OUT_FROM_SUN: readonly string[] = PLANETS.map((planet) => planet.id)

// The planets at true scale in the given order, edge to edge along -X starting just left of the
// Sun. The Sun keeps its own place at the origin, so every planet is lit from the right direction
// without any lesson-specific lighting.
export function lineupSlots(order: readonly string[]): Map<string, LineupSlot> {
  const lineup = new Map<string, LineupSlot>()
  let cursor = LINEUP_SUN_RADIUS + GAP_UNITS
  for (const id of order) {
    const planet = PLANETS.find((definition) => definition.id === id)
    if (!planet) throw new Error(`No planet "${id}" for the size lineup`)
    const radius = scaledBodyRadiusUnits(planet.radiusKm, planet.compactVisualRadius, TRUE_SCALE, AU_KM)
    lineup.set(planet.id, { x: -(cursor + radius), radius })
    cursor = cursor + radius * 2 + GAP_UNITS
  }
  return lineup
}

// Where a planet sits in the lineup in the given order: its center's X and its radius (scene units).
export function lineupSlot(planetId: string, order: readonly string[] = OUT_FROM_SUN): LineupSlot {
  const slot = lineupSlots(order).get(planetId)
  if (!slot) throw new Error(`No planet "${planetId}" in the size lineup`)
  return slot
}

const LINEUP = lineupSlots(OUT_FROM_SUN)

// The planets' extent along X, the same in any order. The Sun is left out: at true scale it is far too big to fit alongside them, so it bulges in from the side.
export const LINEUP_PLANETS_EXTENT = {
  minX: Math.min(...[...LINEUP.values()].map((slot) => slot.x - slot.radius)),
  maxX: Math.max(...[...LINEUP.values()].map((slot) => slot.x + slot.radius)),
}

// A planet's axis as a picture book shows it: tipped from ecliptic north by its real axial tilt,
// but sideways in the picture plane (toward -X, the screen's right) instead of in its real
// direction in space, which may point at the camera - Uranus's does, almost exactly. So the
// equator faces the camera and the poles sit at top and bottom, Uranus lies on its side and Venus
// stands on its head. The spin is the real one.
function lineupOrientation(definition: BodyDefinition, ephemeris: Ephemeris): Pick<PlanetPose, 'poleDirection' | 'tilt' | 'spinRadians'> {
  const real = realOrientation(definition, ephemeris)
  const tiltFromNorth = Math.acos(Math.min(1, Math.max(-1, real.poleDirection[2])))
  const poleDirection: Vec3 = [-Math.sin(tiltFromNorth), 0, Math.cos(tiltFromNorth)]
  return { poleDirection, tilt: axisAlignmentRotation(poleDirection), spinRadians: real.spinRadians }
}

export interface SizesScene {
  // Where each planet is right now; without one, the planets stand in their order out from the Sun.
  arrangement?: LineupArrangement
  turntable?: PlanetTurntable
  // Under each planet's name (see LessonSorting.planetNotes).
  planetNotes?: Record<string, string>
}

// The "Get to know the planets" scene: the Sun and all eight planets at true relative size, the one
// in focus turning on the turntable.
export function sizesLayout(ephemeris: Ephemeris, { arrangement, turntable, planetNotes }: SizesScene = {}): SceneLayout {
  return {
    sun: sunPose(ephemeris, TRUE_SCALE),
    planets: PLANETS.map((definition) => {
      const slot = LINEUP.get(definition.id)!
      const position: Vec3 = arrangement?.position(definition.id) ?? [slot.x, 0, 0]
      const orientation = lineupOrientation(definition, ephemeris)
      const spinRadians = orientation.spinRadians + (turntable?.extraSpin(definition.id) ?? 0)
      return { definition, position, radius: slot.radius, ...orientation, spinRadians }
    }),
    moons: [],
    alwaysShowBodyLabels: true,
    bodyLabelNotes: planetNotes,
  }
}
