import type { ModelStage } from '../../spacecraft/modelScene'

// The assemblies of the Saturn V model (see the data pipeline's apollo/saturnVParts.ts).
export type SaturnVPart =
  | 'les' | 'cm' | 'sm' | 'sla' | 'lm' | 'iu'
  | 'sivb' | 'sivbInside' | 'sivbEngine'
  | 'sii' | 'siiInside' | 'siiEngines'
  | 'sic' | 'sicInside' | 'sicEngines'
  | 'person'

// What a chapter of the Saturn V lesson shows: how far the rocket is taken apart and cut open, the
// part picked out, the parts thrown off, the parts labelled - and where the camera looks.
export interface SaturnVStage extends ModelStage<SaturnVPart> {
  labels?: SaturnVPart[]
  // The stage tops' heights marked beside the rocket (only while it stands assembled).
  heights?: boolean
  shot: SaturnVShotId
}

export type SaturnVShotId = 'whole' | 'exploded' | 'sic' | 'sii' | 'sivb' | 'top' | 'capsule'
