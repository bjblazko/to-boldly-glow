import type { ModelStage } from '../../spacecraft/modelScene'

// The vehicles the lessons take apart (see vehicleLesson.ts and their configs in learn/apollo/).
export type VehicleId = 'saturnV' | 'columbia' | 'eagle'

// What a vehicle lesson's chapter shows: the vehicle, how far it is taken apart and cut open, the
// parts picked out, gone and labelled, the stage heights marked beside it, and the camera's shot.
export interface VehicleStage extends ModelStage<string> {
  vehicle: VehicleId
  shot: string
  // The shot the camera moves on to once the chapter has been read out to its end (the last
  // chapter's close: Columbia's center couch).
  closingShot?: string
  labels?: string[]
  heights?: boolean
}
