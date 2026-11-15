import { loadModel, type ModelDescription } from '../../spacecraft/modelFile'
import { ModelRenderer, type ModelContext } from '../../spacecraft/modelRenderer'
import { goldenRecordMesh } from './goldenRecordMesh'
import { Trajectory } from '../../spacecraft/trajectory'
import type { VoyagerProbeId } from './voyagerStage'

const MODEL_URL = 'models/voyager'
const DATA_URL = 'data/voyager'

// What the Voyager lessons and tours draw with: NASA's model and the Golden Record (with their
// renderers), and both probes' trajectories. All of it comes with the app (about 1.5 MB); it is
// loaded the first time a Voyager lesson or tour needs it, then shared - only one of them runs at a
// time.
export interface VoyagerAssets {
  model: ModelDescription
  probe: ModelRenderer
  record: ModelRenderer
  trajectories: Record<VoyagerProbeId, Trajectory>
}

let loading: Promise<VoyagerAssets> | null = null

export function loadVoyagerAssets(models: ModelContext): Promise<VoyagerAssets> {
  loading ??= load(models)
  return loading
}

async function load(models: ModelContext): Promise<VoyagerAssets> {
  const [model, voyager1, voyager2] = await Promise.all([
    loadModel(`${MODEL_URL}/voyager`),
    Trajectory.load(`${DATA_URL}/voyager1.trajectory.bin`),
    Trajectory.load(`${DATA_URL}/voyager2.trajectory.bin`),
  ])
  const [probe, record] = await Promise.all([ModelRenderer.create(models, model, MODEL_URL), ModelRenderer.create(models, goldenRecordMesh(), MODEL_URL)])
  return { model: model.description, probe, record, trajectories: { voyager1, voyager2 } }
}
