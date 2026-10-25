import { vec3 } from 'gl-matrix'
import type { SolarSystemEntity } from '../../solarSystem/entities'

// Which body the tour flies to next, or null when it is over.
export interface TourItinerary {
  restart(): void
  next(from: vec3, positionOf: (body: SolarSystemEntity) => vec3, justVisited: SolarSystemEntity | null): SolarSystemEntity | null
}

// The endless sightseeing loop: the nearest planet not yet visited in this pass, by live position.
// Once every planet has been visited a new pass starts - skipping the planet just finished, which
// would otherwise be "nearest" again. A short "recently visited" window instead settled into
// circling the two or three mutually closest inner planets forever.
export class NearestItinerary implements TourItinerary {
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

// A set route, stop by stop, ending after the last one (the narrated tour: the Sun, then the
// planets out from it, then home to Earth).
export class RouteItinerary implements TourItinerary {
  private nextStop = 0

  constructor(private readonly stops: SolarSystemEntity[]) {}

  restart(): void {
    this.nextStop = 0
  }

  next(): SolarSystemEntity | null {
    return this.stops[this.nextStop++] ?? null
  }
}
