import { PLANETS } from '../../solarSystem/bodies'

// One turn every this many seconds, for every planet alike - Mercury's 59-day spin would not show,
// nor would Jupiter's 10 hours read as anything but a blur.
export const TURNTABLE_SECONDS_PER_TURN = 30

const RADIANS_PER_SECOND = (2 * Math.PI) / TURNTABLE_SECONDS_PER_TURN

// Turns the planet in focus slowly on its axis, the way it really spins (Venus and Uranus
// backwards). Each planet keeps the turn it has made when the focus moves on, so none jumps back.
export class PlanetTurntable {
  private readonly turns = new Map<string, number>()

  update(deltaSeconds: number, focusPlanetId: string | undefined): void {
    if (!focusPlanetId) return
    const planet = PLANETS.find((definition) => definition.id === focusPlanetId)
    if (!planet) return
    const direction = Math.sign(planet.siderealRotationHours)
    this.turns.set(focusPlanetId, this.extraSpin(focusPlanetId) + direction * RADIANS_PER_SECOND * deltaSeconds)
  }

  // How far the planet has turned on the turntable, on top of its real spin (radians).
  extraSpin(planetId: string): number {
    return this.turns.get(planetId) ?? 0
  }
}
