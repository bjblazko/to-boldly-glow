import { PLANETS, SUN, AU_KM, type BodyDefinition } from '../solarSystem/bodies'
import { MOONS, type MoonDefinition } from '../solarSystem/moons'
import { planetAuPosition } from '../solarSystem/entities'
import { scaledBodyRadiusUnits, scaledPosition } from '../solarSystem/sceneScale'
import { rotationAngleRadians } from '../solarSystem/rotation'
import { axisAlignmentRotation, equatorialToEclipticPoleDirection } from '../solarSystem/poleOrientation'
import { moonOrbitAngleForParent, moonOrbitTilt, moonRelativePosition, moonRotationAngleRadians, scaledMoonOrbitRadiusUnits } from '../solarSystem/moonOrbit'
import type { Ephemeris } from '../time/ephemeris'
import type { Vec3 } from '../math/tuples'
import type { BodyPose, MoonPose, PlanetPose, SceneLayout, SunPose } from './sceneLayout'

// The free-exploration scene: every body at its real position for the simulated date, sized and
// spaced by the Realistic/Compact scale blend.
export function exploreLayout(ephemeris: Ephemeris, scaleBlend: number, showMoons: boolean): SceneLayout {
  const planets = PLANETS.map((definition) => realPlanetPose(definition, ephemeris, scaleBlend))
  return {
    sun: sunPose(ephemeris, scaleBlend),
    planets,
    moons: showMoons ? moonPoses(planets, ephemeris, scaleBlend) : [],
  }
}

// The Sun stays at the world origin in every scene; only its size follows the scale blend.
export function sunPose(ephemeris: Ephemeris, scaleBlend: number): SunPose {
  return {
    position: [0, 0, 0],
    radius: scaledBodyRadiusUnits(SUN.radiusKm, SUN.compactVisualRadius, scaleBlend, AU_KM),
    ...realOrientation(SUN, ephemeris),
  }
}

export function realPlanetPose(definition: BodyDefinition, ephemeris: Ephemeris, scaleBlend: number): PlanetPose {
  return {
    definition,
    position: scaledPosition(planetAuPosition(definition, ephemeris.julianMillennia), scaleBlend),
    radius: scaledBodyRadiusUnits(definition.radiusKm, definition.compactVisualRadius, scaleBlend, AU_KM),
    ...realOrientation(definition, ephemeris),
  }
}

// A body's real IAU spin axis and its rotation angle on the simulated date.
export function realOrientation(definition: BodyDefinition, ephemeris: Ephemeris): Pick<PlanetPose, 'poleDirection' | 'tilt' | 'spinRadians'> {
  const poleDirection = equatorialToEclipticPoleDirection(definition.poleRightAscensionDegrees, definition.poleDeclinationDegrees)
  return {
    poleDirection,
    tilt: axisAlignmentRotation(poleDirection),
    spinRadians: rotationAngleRadians(ephemeris.daysSinceEpoch, definition.siderealRotationHours),
  }
}

function moonPoses(planets: PlanetPose[], ephemeris: Ephemeris, scaleBlend: number): MoonPose[] {
  return MOONS.flatMap((definition) => {
    const parent = planets.find((planet) => planet.definition.id === definition.parentId)
    return parent ? [moonPose(definition, parent, ephemeris, scaleBlend)] : []
  })
}

// Tidally locked (every moon here): the spin follows the orbital angle, and the same orbital-plane
// tilt orients both position and spin, so the near side keeps facing the parent at any inclination.
function moonPose(definition: MoonDefinition, parent: PlanetPose, ephemeris: Ephemeris, scaleBlend: number): MoonPose {
  const orbitAngle = moonOrbitAngleForParent(ephemeris.daysSinceEpoch, definition, parent.definition)
  const orbitRadius = scaledMoonOrbitRadiusUnits(definition.orbitDistanceKm, definition.compactOrbitVisualRadius, scaleBlend, AU_KM)
  const tilt = moonOrbitTilt(definition, parent.definition)
  const offset = moonRelativePosition(orbitRadius, orbitAngle, tilt)
  const pose: BodyPose = {
    position: offsetFrom(parent.position, offset),
    radius: scaledBodyRadiusUnits(definition.radiusKm, definition.compactVisualRadius, scaleBlend, AU_KM),
    tilt,
    spinRadians: moonRotationAngleRadians(orbitAngle),
  }
  return { ...pose, definition, parent }
}

function offsetFrom(origin: Vec3, offset: ArrayLike<number>): Vec3 {
  return [origin[0] + offset[0], origin[1] + offset[1], origin[2] + offset[2]]
}
