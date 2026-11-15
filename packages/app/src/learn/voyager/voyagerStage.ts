// What a chapter of the Voyager lessons shows. Moving between two chapters of the same kind eases
// from one stage to the next (the probe opening up, the record turning over); a route chapter
// replays its stretch of time.

export type VoyagerProbeId = 'voyager1' | 'voyager2'

// The assemblies NASA's model is taken apart into (see the data pipeline's voyagerAssemblies.ts).
export type VoyagerPart = 'bus' | 'dish' | 'rtg' | 'science' | 'magnetometer' | 'record'

// The engravings on the record's cover.
export type RecordFeature = 'playing' | 'stylus' | 'signal' | 'firstImage' | 'pulsarMap' | 'hydrogen'

// Where the camera stands on the route (see routeShots.ts).
export type RouteView = 'launch' | 'jupiter' | 'saturn' | 'outer' | 'side' | 'paleBlueDot' | 'heliosphere'

export interface RouteStage {
  // The stretch of time the chapter plays through (ISO dates), then holds at its end.
  from: string
  to: string
  view: RouteView
  // The probes whose path and marker show (both if not given).
  probes?: VoyagerProbeId[]
}

export interface VoyagerStage {
  // 'voyagerProbe': how far it is taken apart (0 to 1), the part picked out, the parts labelled.
  explode?: number
  highlight?: VoyagerPart
  labels?: VoyagerPart[]
  // 'voyagerRecord': the side facing the camera, and the engravings labelled.
  side?: 'cover' | 'label'
  // The record turning as it plays: 16⅔ turns a minute.
  spinning?: boolean
  features?: RecordFeature[]
  // 'voyagerRoute'
  route?: RouteStage
}
