import { vec3 } from 'gl-matrix'
import type { SolarSystemEntity } from '../../solarSystem/entities'

// Which planet the tour visits next: the nearest one not yet visited in this pass, by live
// position. Once every planet has been visited a new pass starts - skipping the planet just
// finished, which would otherwise be "nearest" again. A short "recently visited" window instead
// settled into circling the two or three mutually closest inner planets forever.
export class TourItinerary {
  private visitedThisPass: string[] = []

  constructor(private readonly planets: SolarSystemEntity[]) {}

  restart(): void {
    this.visitedThisPass = []
  }

  next(from: vec3, positionOf: (planet: SolarSystemEntity) => vec3, justVisited: SolarSystemEntity | null): SolarSystemEntity {
    if (this.visitedThisPass.length >= this.planets.length) this.visitedThisPass = justVisited ? [justVisited.id] : []
    const candidates = this.planets.filter((planet) => !this.visitedThisPass.includes(planet.id))
    const distanceTo = (planet: SolarSystemEntity) => vec3.distance(from, positionOf(planet))
    const nearest = candidates.reduce<SolarSystemEntity | null>(
      (best, planet) => (best === null || distanceTo(planet) < distanceTo(best) ? planet : best),
      null,
    )
    const next = nearest ?? this.planets[0]
    this.visitedThisPass.push(next.id)
    return next
  }
}
