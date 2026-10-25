import { ALL_ENTITIES } from '../../solarSystem/entities'
import type { TourListener, TourPacing, TourRoute } from '../tourController'
import { RouteItinerary } from './tourItinerary'

// The narrated tour's stops: the Sun, the planets out from it, and home to Earth.
export const GRAND_TOUR_STOP_IDS = ['sun', 'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'earth'] as const

const GRAND_TOUR_STOPS = GRAND_TOUR_STOP_IDS.map((id) => ALL_ENTITIES.find((entity) => entity.id === id)!)

export function grandTourRoute(guide: { pacing?: TourPacing; listener?: TourListener } = {}): TourRoute {
  return { itinerary: new RouteItinerary(GRAND_TOUR_STOPS), ...guide }
}
