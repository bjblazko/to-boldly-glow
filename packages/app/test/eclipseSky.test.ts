import { describe, expect, it } from 'vitest'
import { circleOverlapFraction } from '../src/lensFlare/circleOverlap'
import { diamondStrength, eclipseSkyLight as skyLight } from '../src/learn/eclipse/eclipseSkyLight'
import { OBSERVER, REAL_SUN_ANGULAR_RADIUS, skyMoon, SUN_ANGULAR_RADIUS, SUNWARD, TOWARD_SUN_ON_HORIZON, ZENITH } from '../src/learn/eclipse/skyGeometry'
import { SOLAR_ECLIPSE_LESSON } from '../src/learn/lessons/solarEclipse'

const dot = (a: ArrayLike<number>, b: ArrayLike<number>) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

// The Moon as the observer sees it: its direction and angular radius.
function seenMoon(separation: number, sizeRatio: number): { direction: number[]; angularRadius: number } {
  const { position, radius } = skyMoon(separation, sizeRatio)
  const offset = [0, 1, 2].map((i) => position[i] - OBSERVER[i])
  const distance = Math.hypot(...offset)
  return { direction: offset.map((value) => value / distance), angularRadius: Math.asin(radius / distance) }
}

// How much of the Sun's disc the Moon leaves uncovered for a chapter's stage.
function sunVisibleAt(chapterId: string): number {
  const { skySeparation, moonSizeRatio } = SOLAR_ECLIPSE_LESSON.chapters.find((chapter) => chapter.id === chapterId)!.eclipse!
  return 1 - circleOverlapFraction(1, moonSizeRatio, skySeparation)
}

describe('the solar eclipse seen from the ground', () => {
  it('stands the observer under a sky whose zenith is straight up, with the Sun 12 degrees above a level horizon', () => {
    expect(Math.hypot(...ZENITH)).toBeCloseTo(1, 9)
    expect((Math.asin(dot(SUNWARD, ZENITH)) * 180) / Math.PI).toBeCloseTo(12, 6)
    expect(dot(TOWARD_SUN_ON_HORIZON, ZENITH)).toBeCloseTo(0, 6)
    // The Sun is at the origin, straight along SUNWARD from the observer.
    expect(dot(OBSERVER, SUNWARD)).toBeLessThan(0)
  })

  it('shows the Sun about ten times bigger than in the real sky', () => {
    expect(SUN_ANGULAR_RADIUS / REAL_SUN_ANGULAR_RADIUS).toBeGreaterThan(9)
    expect(SUN_ANGULAR_RADIUS / REAL_SUN_ANGULAR_RADIUS).toBeLessThan(12)
  })

  it("puts the Moon at the stage's apparent size and separation from the Sun's center", () => {
    for (const [separation, sizeRatio] of [[0, 1.04], [0.7, 1.04], [1.1, 0.93]]) {
      const moon = seenMoon(separation, sizeRatio)
      expect(moon.angularRadius / SUN_ANGULAR_RADIUS).toBeCloseTo(sizeRatio, 4)
      expect(Math.acos(Math.min(1, dot(moon.direction, SUNWARD))) / SUN_ANGULAR_RADIUS).toBeCloseTo(separation, 4)
    }
  })

  it('brings the Moon in from the west: right of the Sun for an observer facing it, and a little lower', () => {
    const moon = seenMoon(1, 1)
    const right = [
      TOWARD_SUN_ON_HORIZON[1] * ZENITH[2] - TOWARD_SUN_ON_HORIZON[2] * ZENITH[1],
      TOWARD_SUN_ON_HORIZON[2] * ZENITH[0] - TOWARD_SUN_ON_HORIZON[0] * ZENITH[2],
      TOWARD_SUN_ON_HORIZON[0] * ZENITH[1] - TOWARD_SUN_ON_HORIZON[1] * ZENITH[0],
    ]
    expect(dot(moon.direction, right)).toBeGreaterThan(0)
    expect(dot(moon.direction, ZENITH)).toBeLessThan(dot(SUNWARD, ZENITH))
  })

  it('stages each ground chapter as its name says', () => {
    expect(sunVisibleAt('first-contact')).toBeGreaterThan(0.5)
    expect(sunVisibleAt('first-contact')).toBeLessThan(0.9)
    expect(sunVisibleAt('partial')).toBeGreaterThan(0.2)
    expect(sunVisibleAt('partial')).toBeLessThan(sunVisibleAt('first-contact'))
    // The diamond ring: only a sliver left, enough to glint.
    expect(sunVisibleAt('diamond-ring')).toBeGreaterThan(0.004)
    expect(diamondStrength(sunVisibleAt('diamond-ring'))).toBeGreaterThan(0.9)
    expect(sunVisibleAt('totality')).toBe(0)
    // The ring of fire: the Moon fits inside the Sun's disc and a bright ring remains.
    expect(sunVisibleAt('annular')).toBeGreaterThan(0.1)
    expect(diamondStrength(sunVisibleAt('annular'))).toBe(0)
  })

  it('fades the daylight as the Sun disappears - slowly at first, then all at once - into the glow of totality', () => {
    expect(skyLight(1)).toEqual({ daylight: 1, glow: 0, glowSpread: 1, hidesStars: 1 })
    expect(skyLight(0)).toEqual({ daylight: 0, glow: 1, glowSpread: 1, hidesStars: 0 })
    // With half the Sun gone the sky still looks like day.
    expect(skyLight(0.5).daylight).toBeGreaterThan(0.7)
    let previous = 0
    for (let visible = 0.001; visible <= 1; visible += 0.001) {
      const { daylight } = skyLight(visible)
      expect(daylight).toBeGreaterThanOrEqual(previous)
      previous = daylight
    }
  })

  it('glints only while a last sliver of the Sun is left', () => {
    expect(diamondStrength(0)).toBe(0)
    expect(diamondStrength(0.015)).toBe(1)
    expect(diamondStrength(0.3)).toBe(0)
  })
})
