import { PLANETS } from '../../solarSystem/bodies'
import { axisAlignmentRotation } from '../../solarSystem/poleOrientation'
import { EasedTween } from '../../math/easedTween'
import { clamp, type Rgb, type Rgba, type Vec3 } from '../../math/tuples'
import { sunlightDirection } from '../../bodies/litBodyUniforms'
import { sunPose } from '../../scene/exploreLayout'
import type { PlanetPose, SceneLayout } from '../../scene/sceneLayout'
import type { Ephemeris } from '../../time/ephemeris'
import { orbitPositionForPhase } from './overlayGeometry'
import { OBLIQUITY_RADIANS, ORBIT_FIXED_POLE_DIRECTION, ORBIT_FIXED_TILT_MATRIX, seasonalPoleDirection, subsolarLatitude } from './seasonalPole'

export type SeasonsChapterKind = 'staged' | 'orbit'

// The staged chapters are a diagram, not a scale model: Earth is held at a fixed spot next to the
// Sun (which never moves from the origin), enlarged for legibility.
export const EARTH_STAGED_POSITION: Vec3 = [9, 0, 0]
const EARTH_STAGED_RADIUS = 2.2

// The orbit chapter's compact circular orbit, wide enough to keep Earth clear of the Sun's ~3-unit
// disc as it passes in front of or behind it; Earth is smaller here, in a wider shot.
export const ORBIT_PATH_RADIUS = 11
const ORBIT_EARTH_RADIUS = 0.8
// A lap every 28 seconds: slow enough to read the live angle label, fast enough to watch.
const ORBIT_REVOLUTION_DEGREES_PER_SECOND = 360 / 28

// The staged Earth turns once every 12 seconds. In the orbit chapter's wide shot that is too subtle
// to tell which of the drawn lines is the real rotation axis, so it turns every 3 seconds there.
const STAGED_SPIN_RADIANS_PER_SECOND = (2 * Math.PI) / 12
const ORBIT_SPIN_RADIANS_PER_SECOND = (2 * Math.PI) / 3

// Tints the hemisphere tilted toward the Sun warm and the other cool. The base alpha keeps both
// faintly visible at the equinoxes; at the solstices the favored one gets the full range on top.
const HEMISPHERE_BASE_ALPHA = 0.08
const HEMISPHERE_ALPHA_RANGE = 0.24
const NORTH_HEMISPHERE_TINT: Rgb = [1.0, 0.55, 0.15]
const SOUTH_HEMISPHERE_TINT: Rgb = [0.25, 0.55, 1.0]

const SEASON_PHASE_TWEEN_SECONDS = 1
const EARTH = PLANETS.find((planet) => planet.id === 'earth')!

// The seasons lesson's scene: Earth alone next to the Sun, either staged at a fixed spot with its
// axis turned to a chapter's season, or circling a compact orbit with its axis fixed in space.
export class SeasonsScene {
  private seasonPhase = 0
  private readonly seasonPhaseTween = new EasedTween(0, SEASON_PHASE_TWEEN_SECONDS)
  private stagedSpin = 0
  private orbitRevolutionDegrees = 0
  private orbitSpin = 0

  start(seasonPhaseDegrees: number): void {
    this.snapToSeason(seasonPhaseDegrees)
    this.stagedSpin = 0
    this.orbitRevolutionDegrees = 0
    this.orbitSpin = 0
  }

  // Between two staged chapters the axis turns smoothly, the short way around the year. Switching
  // between staged and orbit snaps: a season tilt and an orbit position are different quantities.
  showSeason(seasonPhaseDegrees: number, chapterKindChanged: boolean): void {
    if (chapterKindChanged) {
      this.snapToSeason(seasonPhaseDegrees)
      return
    }
    const shortestDelta = ((seasonPhaseDegrees - this.seasonPhase + 540) % 360) - 180
    this.seasonPhaseTween.retarget(this.seasonPhase + shortestDelta, this.seasonPhase)
  }

  // Earth keeps turning (and orbiting) through chapter changes; only a new lesson resets it.
  update(deltaSeconds: number, kind: SeasonsChapterKind): void {
    if (this.seasonPhaseTween.isAnimating) this.seasonPhase = this.seasonPhaseTween.update(deltaSeconds)
    this.stagedSpin += deltaSeconds * STAGED_SPIN_RADIANS_PER_SECOND
    if (kind === 'orbit') {
      this.orbitRevolutionDegrees += deltaSeconds * ORBIT_REVOLUTION_DEGREES_PER_SECOND
      this.orbitSpin += deltaSeconds * ORBIT_SPIN_RADIANS_PER_SECOND
    }
  }

  // Laid out around a Compact-size Sun, whatever the explore view's scale toggle says.
  layout(kind: SeasonsChapterKind, ephemeris: Ephemeris): SceneLayout {
    const earth = kind === 'orbit' ? this.orbitingEarth() : this.stagedEarth()
    return { sun: sunPose(ephemeris, 1), planets: [withHemisphereTints(earth)], moons: [] }
  }

  private snapToSeason(seasonPhaseDegrees: number): void {
    this.seasonPhase = seasonPhaseDegrees
    this.seasonPhaseTween.retarget(seasonPhaseDegrees, seasonPhaseDegrees)
  }

  private stagedEarth(): PlanetPose {
    const poleDirection = seasonalPoleDirection(this.seasonPhase)
    return {
      definition: EARTH,
      position: EARTH_STAGED_POSITION,
      radius: EARTH_STAGED_RADIUS,
      poleDirection,
      tilt: axisAlignmentRotation(poleDirection),
      spinRadians: this.stagedSpin,
    }
  }

  private orbitingEarth(): PlanetPose {
    return {
      definition: EARTH,
      position: orbitPositionForPhase(this.orbitRevolutionDegrees, ORBIT_PATH_RADIUS),
      radius: ORBIT_EARTH_RADIUS,
      poleDirection: ORBIT_FIXED_POLE_DIRECTION,
      tilt: ORBIT_FIXED_TILT_MATRIX,
      spinRadians: this.orbitSpin,
    }
  }
}

function withHemisphereTints(earth: PlanetPose): PlanetPose {
  const light = sunlightDirection(earth.position)
  const favor = clamp(subsolarLatitude(earth.poleDirection, [-light[0], -light[1], -light[2]]) / OBLIQUITY_RADIANS, -1, 1)
  const tint = (color: Rgb, favored: number): Rgba => [...color, HEMISPHERE_BASE_ALPHA + HEMISPHERE_ALPHA_RANGE * Math.max(0, favored)]
  return { ...earth, hemisphereTints: { north: tint(NORTH_HEMISPHERE_TINT, favor), south: tint(SOUTH_HEMISPHERE_TINT, -favor) } }
}
