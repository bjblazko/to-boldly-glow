// One chapter of the Apollo 11 lesson (see apolloRouteLesson.ts): where the camera looks, how far
// the craft goes along the drawn route in it, and what else is marked.
export type ApolloRouteView = 'earth' | 'whole' | 'moon'
export type ApolloBurn = 'tli' | 'loi' | 'tei'

export interface ApolloRouteStage {
  view: ApolloRouteView
  // The craft's progress along the route (routeGeometry.ts: 0 liftoff ... 5 splashdown), from where
  // the chapter starts to where it ends.
  from: number
  to: number
  // Eagle on its own (0 undocking, 1 landed, 2 back at Columbia), while it flies apart from it.
  eagle?: { from: number; to: number }
  // The free return drawn: the way home the craft would have taken without braking into orbit.
  freeReturn?: boolean
  // A burn marked where it happened.
  burn?: ApolloBurn
  // The event (apollo11Events.ts) whose time the clock shows.
  event: string
}
