import type { LessonShot } from '../lessonShot'
import type { ModelSceneOptions } from '../../spacecraft/modelScene'
import type { RoomShape } from './blueprintRoom'

// One model of a vehicle: where it lives under public/ (`<url>/<name>.json`) and its light.
export interface VehicleModel {
  url: string
  name: string
  light?: ModelSceneOptions['light']
}

// What a vehicle lesson needs to know about one vehicle: its models (the outside first - its
// marked heights are shown), how it turns, the room it stands in, its shots, and the words for its
// parts and heights.
export interface VehicleConfig {
  models: VehicleModel[]
  turntable: Omit<ModelSceneOptions, 'light'>
  room: RoomShape
  shot(id: string): LessonShot
  partName(part: string): string
  mark(name: string): { label: string; note?: string }
}
