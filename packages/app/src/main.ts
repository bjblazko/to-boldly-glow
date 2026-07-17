import { mat4 } from 'gl-matrix'
import { generateSphereMesh } from './geometry/sphere'
import { createLitPipeline, createMeshBuffers, initWebGpu } from './renderer/webgpu'

async function main() {
  const canvas = document.querySelector<HTMLCanvasElement>('#scene')
  if (!canvas) throw new Error('Canvas element #scene not found.')
  canvas.width = 800
  canvas.height = 600

  const { device, context, format, depthTexture } = await initWebGpu(canvas)
  const pipeline = createLitPipeline(device, format)
  const mesh = generateSphereMesh(1, 32, 32)
  const buffers = createMeshBuffers(device, mesh)

  // Uniforms: worldViewProjection(16) + world(16) + color(4) + lightDirection(4) = 40 floats.
  const uniformBuffer = device.createBuffer({
    label: 'sphere uniforms',
    size: 40 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
  })

  const projection = mat4.perspective(mat4.create(), Math.PI / 4, canvas.width / canvas.height, 0.1, 100)
  const view = mat4.lookAt(mat4.create(), [0, 0, 5], [0, 0, 0], [0, 1, 0])
  const world = mat4.identity(mat4.create())
  const worldViewProjection = mat4.multiply(mat4.create(), projection, mat4.multiply(mat4.create(), view, world))

  const uniformData = new Float32Array(40)
  uniformData.set(worldViewProjection, 0)
  uniformData.set(world, 16)
  uniformData.set([0.6, 0.6, 0.65, 1.0], 32) // color
  const lightDirection = [0.3, -0.5, -1.0]
  const lightLength = Math.hypot(...lightDirection)
  uniformData.set(lightDirection.map((v) => v / lightLength), 36) // lightDirection.xyz, .w stays 0
  device.queue.writeBuffer(uniformBuffer, 0, uniformData)

  function frame() {
    const encoder = device.createCommandEncoder({ label: 'frame encoder' })
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0.02, g: 0.02, b: 0.05, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
      depthStencilAttachment: {
        view: depthTexture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
    })
    pass.setPipeline(pipeline)
    pass.setVertexBuffer(0, buffers.positionBuffer)
    pass.setVertexBuffer(1, buffers.normalBuffer)
    pass.setIndexBuffer(buffers.indexBuffer, 'uint32')
    pass.setBindGroup(0, bindGroup)
    pass.drawIndexed(buffers.indexCount)
    pass.end()
    device.queue.submit([encoder.finish()])
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}

main().catch((error) => {
  const canvas = document.querySelector<HTMLCanvasElement>('#scene')
  if (canvas) canvas.replaceWith(document.createTextNode(`Failed to start renderer: ${error.message}`))
  console.error(error)
})
