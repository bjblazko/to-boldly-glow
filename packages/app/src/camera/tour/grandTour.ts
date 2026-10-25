import type { NarrationStop } from '../../narration/scripts/en'
import { ALL_ENTITIES, type SolarSystemEntity } from '../../solarSystem/entities'
import type { TourListener, TourPacing, TourRoute } from '../tourController'
import { RouteItinerary } from './tourItinerary'

// The narrated tour, stop by stop: the body the ship circles, and what the narrator calls it - the
// Sun, the planets out from it, and home to Earth.
export const GRAND_TOUR: readonly { bodyId: string; stop: NarrationStop }[] = [
  { bodyId: 'sun', stop: 'sun' },
  { bodyId: 'mercury', stop: 'mercury' },
  { bodyId: 'venus', stop: 'venus' },
  { bodyId: 'earth', stop: 'earth' },
  { bodyId: 'mars', stop: 'mars' },
  { bodyId: 'jupiter', stop: 'jupiter' },
  { bodyId: 'saturn', stop: 'saturn' },
  { bodyId: 'uranus', stop: 'uranus' },
  { bodyId: 'neptune', stop: 'neptune' },
  { bodyId: 'earth', stop: 'home' },
]

const GRAND_TOUR_BODIES: SolarSystemEntity[] = GRAND_TOUR.map(({ bodyId }) => ALL_ENTITIES.find((entity) => entity.id === bodyId)!)

export function grandTourRoute(guide: { pacing?: TourPacing; listener?: TourListener } = {}): TourRoute {
  return { itinerary: new RouteItinerary(GRAND_TOUR_BODIES), ...guide }
}
