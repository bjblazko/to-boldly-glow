import { AU_KM, PLANETS, SUN } from '../../solarSystem/bodies'
import { scaledBodyRadiusUnits } from '../../solarSystem/sceneScale'
import { realOrientation, sunPose } from '../../scene/exploreLayout'
import type { SceneLayout } from '../../scene/sceneLayout'
import type { Ephemeris } from '../../time/ephemeris'

const GAP_UNITS = 0.015
const TRUE_SCALE = 0

interface LineupSlot {
  x: number
  radius: number
}

// The planets at true scale, largest to smallest, edge to edge along -X starting just left of the
// Sun. The Sun keeps its own place at the origin, so every planet is lit from the right direction
// without any lesson-specific lighting.
function buildLineup(): Map<string, LineupSlot> {
  const lineup = new Map<string, LineupSlot>()
  let cursor = scaledBodyRadiusUnits(SUN.radiusKm, SUN.compactVisualRadius, TRUE_SCALE, AU_KM) + GAP_UNITS
  for (const planet of [...PLANETS].sort((a, b) => b.radiusKm - a.radiusKm)) {
    const radius = scaledBodyRadiusUnits(planet.radiusKm, planet.compactVisualRadius, TRUE_SCALE, AU_KM)
    lineup.set(planet.id, { x: -(cursor + radius), radius })
    cursor = cursor + radius * 2 + GAP_UNITS
  }
  return lineup
}

const LINEUP = buildLineup()

// The planets' extent along X, from Jupiter's edge nearest the Sun to Mercury's far edge. The Sun
// is left out: at true scale it is far too big to fit alongside them, so it bulges in from the side.
export const LINEUP_PLANETS_EXTENT = {
  minX: Math.min(...[...LINEUP.values()].map((slot) => slot.x - slot.radius)),
  maxX: Math.max(...[...LINEUP.values()].map((slot) => slot.x + slot.radius)),
}

// The "How big are the planets?" scene: the Sun and all eight planets at true relative size.
export function sizesLayout(ephemeris: Ephemeris): SceneLayout {
  return {
    sun: sunPose(ephemeris, TRUE_SCALE),
    planets: PLANETS.map((definition) => {
      const slot = LINEUP.get(definition.id)!
      return { definition, position: [slot.x, 0, 0], radius: slot.radius, ...realOrientation(definition, ephemeris) }
    }),
    moons: [],
    alwaysShowBodyLabels: true,
  }
}
