import type { SolarSystemEntity } from '../../solarSystem/entities'
import type { LegPace } from './tourLeg'
import type { TourItinerary } from './tourItinerary'

export interface TourStart {
  position: readonly [number, number, number]
  forward?: readonly [number, number, number]
}

// What the narrated tour tells the ship: how long it should take at a body, and when it may leave.
export interface TourPacing {
  pace(target: SolarSystemEntity): LegPace
  // While false, the ship keeps circling the body (the narrator hasn't finished).
  mayDepart(target: SolarSystemEntity): boolean
}

export interface TourListener {
  onLegStart?(target: SolarSystemEntity): void
  // The ship is about its leg's transit time (see TourPacing) from the stop - at once on the first
  // leg, and at the latest on arrival. The narrator's words for the stop end as the ship gets there.
  onApproach?(target: SolarSystemEntity): void
  onLoopEnter?(target: SolarSystemEntity): void
  // The route is over: the ship stays circling its last stop.
  onFinished?(): void
}

// Where the tour goes: the endless nearest-planet loop by default, or a set route with its pace.
export interface TourRoute {
  itinerary: TourItinerary
  pacing?: TourPacing
  listener?: TourListener
}
