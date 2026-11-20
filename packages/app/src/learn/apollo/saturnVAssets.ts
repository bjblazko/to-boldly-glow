import { loadModel, type ModelDescription } from '../../spacecraft/modelFile'
import { ModelRenderer, type ModelContext } from '../../spacecraft/modelRenderer'

const MODEL_URL = 'models/saturnV'

// The Saturn V model (built from its dimensions, about 0.9 MB, bundled with the app), loaded the
// first time the lesson opens, then kept.
export interface SaturnVAssets {
  model: ModelDescription
  renderer: ModelRenderer
}

let loading: Promise<SaturnVAssets> | null = null

export function loadSaturnVAssets(models: ModelContext): Promise<SaturnVAssets> {
  loading ??= load(models)
  return loading
}

async function load(models: ModelContext): Promise<SaturnVAssets> {
  const model = await loadModel(`${MODEL_URL}/saturnV`)
  return { model: model.description, renderer: await ModelRenderer.create(models, model, MODEL_URL) }
}
