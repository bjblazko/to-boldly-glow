import { loadModel, type ModelData, type ModelDescription } from '../../spacecraft/modelFile'
import { ModelRenderer, type ModelContext } from '../../spacecraft/modelRenderer'
import type { VehicleModel } from './vehicleConfig'

export interface LoadedModel {
  model: ModelDescription
  renderer: ModelRenderer
  // Its triangles, kept for picking what a double click points at.
  data: ModelData
}

const loading = new Map<string, Promise<LoadedModel>>()

// A vehicle's model (bundled with the app), loaded the first time a lesson needs it, then kept.
export function loadVehicleModel(models: ModelContext, { url, name, lamps }: VehicleModel): Promise<LoadedModel> {
  const key = `${url}/${name}`
  let pending = loading.get(key)
  if (!pending) {
    pending = loadModel(key).then(async (model) => ({ model: model.description, data: model, renderer: await ModelRenderer.create(models, model, url, { shadows: Boolean(lamps?.length) }) }))
    loading.set(key, pending)
  }
  return pending
}
