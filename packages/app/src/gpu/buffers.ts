// GPU buffer helpers shared by every feature: uniform blocks and static vertex/index data.

// A uniform buffer together with the bind group that exposes it (at binding 0) and any further
// resources (textures, samplers, at bindings 1, 2, ...) to a pipeline's group 0.
export interface UniformBinding {
  buffer: GPUBuffer
  bindGroup: GPUBindGroup
}

export interface UniformBindingSpec {
  label: string
  floatCount: number
  resources?: GPUBindingResource[]
}

export function createUniformBinding(device: GPUDevice, pipeline: GPURenderPipeline | GPUComputePipeline, spec: UniformBindingSpec): UniformBinding {
  const buffer = device.createBuffer({
    label: `${spec.label} uniforms`,
    size: spec.floatCount * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })
  const entries: GPUBindGroupEntry[] = [
    { binding: 0, resource: { buffer } },
    ...(spec.resources ?? []).map((resource, index) => ({ binding: index + 1, resource })),
  ]
  const bindGroup = device.createBindGroup({ label: spec.label, layout: pipeline.getBindGroupLayout(0), entries })
  return { buffer, bindGroup }
}

export function writeUniforms(device: GPUDevice, binding: UniformBinding, values: Float32Array<ArrayBuffer>): void {
  device.queue.writeBuffer(binding.buffer, 0, values)
}

export function createVertexBuffer(device: GPUDevice, label: string, values: Float32Array | Uint32Array, usage = GPUBufferUsage.VERTEX): GPUBuffer {
  const buffer = device.createBuffer({ label, size: values.byteLength, usage: usage | GPUBufferUsage.COPY_DST })
  device.queue.writeBuffer(buffer, 0, values as BufferSource)
  return buffer
}
