import { mat4, vec3 } from 'gl-matrix'
import {
  calendarToJulianDay,
  earthHeliocentricB,
  earthHeliocentricL,
  earthHeliocentricR,
  julianMillenniaSinceJ2000,
  sphericalToX,
  sphericalToY,
  sphericalToZ,
} from '@toboldlyglow/engine'
import { generateSphereMesh } from './geometry/sphere'
import { OrbitCamera } from './camera/orbitCamera'
import { FlyCamera } from './camera/flyCamera'
import { CameraInputController } from './camera/inputController'
import { SimulationClock } from './time/simulationClock'
import { TimeControlUI } from './time/timeControlUI'
import {
  createLitPipeline,
  createMeshBuffers,
  createUnlitPipeline,
  initWebGpu,
  type MeshBuffers,
} from './renderer/webgpu'

// TEMPORARY visual scale, not physically accurate — see the orbital-mechanics/renderer-core plans.
const AU_TO_SCENE_UNITS = 20
const SUN_VISUAL_RADIUS = 3
const EARTH_VISUAL_RADIUS = 1

function earthPositionInSceneUnits(date: Date): [number, number, number] {
  const julianDay = calendarToJulianDay(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate() + date.getUTCHours() / 24,
  )
  const T = julianMillenniaSinceJ2000(julianDay)
  const L = earthHeliocentricL(T)
  const B = earthHeliocentricB(T)
  const R = earthHeliocentricR(T)
  return [
    sphericalToX(L, B, R) * AU_TO_SCENE_UNITS,
    sphericalToY(L, B, R) * AU_TO_SCENE_UNITS,
    sphericalToZ(L, B, R) * AU_TO_SCENE_UNITS,
  ]
}

function requireElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector)
  if (!element) throw new Error(`Required element ${selector} not found.`)
  return element
}

async function main() {
  const canvasElement = document.querySelector<HTMLCanvasElement>('#scene')
  if (!canvasElement) throw new Error('Canvas element #scene not found.')
  const canvas: HTMLCanvasElement = canvasElement
  canvas.width = 800
  canvas.height = 600

  const { device, context, format, depthTexture } = await initWebGpu(canvas)
  const litPipeline = await createLitPipeline(device, format)
  const unlitPipeline = await createUnlitPipeline(device, format)

  const sphereMesh = generateSphereMesh(1, 32, 32)
  const meshBuffers = createMeshBuffers(device, sphereMesh)

  const sunUniformBuffer = device.createBuffer({
    label: 'sun uniforms',
    size: 20 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })
  const sunBindGroup = device.createBindGroup({
    layout: unlitPipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: sunUniformBuffer } }],
  })

  const earthUniformBuffer = device.createBuffer({
    label: 'earth uniforms',
    size: 40 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })
  const earthBindGroup = device.createBindGroup({
    layout: litPipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: earthUniformBuffer } }],
  })

  const projection = mat4.perspective(mat4.create(), Math.PI / 4, canvas.width / canvas.height, 0.1, 1000)

  const orbitCamera = new OrbitCamera({ radius: 65, azimuth: 0, elevation: 0.4 })
  const flyCamera = new FlyCamera({ position: [0, 25, 60], yaw: Math.PI, pitch: 0 })
  const cameraInput = new CameraInputController(canvas, orbitCamera, flyCamera)

  const modeToggleButton = document.querySelector<HTMLButtonElement>('#camera-mode-toggle')
  modeToggleButton?.addEventListener('click', () => {
    const nextMode = cameraInput.mode === 'orbit' ? 'fly' : 'orbit'
    cameraInput.setMode(nextMode)
    modeToggleButton.textContent =
      nextMode === 'orbit' ? 'Switch to Free-fly Camera' : 'Switch to Orbit Camera'
  })

  const simulationClock = new SimulationClock()
  const timeControlUI = new TimeControlUI(
    simulationClock,
    requireElement<HTMLButtonElement>('#time-play-pause'),
    requireElement<HTMLButtonElement>('#time-reverse'),
    requireElement<HTMLSelectElement>('#time-preset-select'),
    requireElement<HTMLInputElement>('#time-shuttle'),
    requireElement<HTMLElement>('#time-display'),
  )

  function drawBody(
    pass: GPURenderPassEncoder,
    pipeline: GPURenderPipeline,
    buffers: MeshBuffers,
    bindGroup: GPUBindGroup,
  ) {
    pass.setPipeline(pipeline)
    pass.setVertexBuffer(0, buffers.positionBuffer)
    pass.setVertexBuffer(1, buffers.normalBuffer)
    pass.setIndexBuffer(buffers.indexBuffer, 'uint32')
    pass.setBindGroup(0, bindGroup)
    pass.drawIndexed(buffers.indexCount)
  }

  let lastFrameTime = performance.now()

  function frame() {
    const now = performance.now()
    const deltaSeconds = (now - lastFrameTime) / 1000
    lastFrameTime = now
    cameraInput.update(deltaSeconds)
    simulationClock.update(deltaSeconds)
    timeControlUI.refreshDisplay()

    const view = cameraInput.getViewMatrix()
    const sunPosition: [number, number, number] = [0, 0, 0]
    const earthPosition = earthPositionInSceneUnits(simulationClock.getCurrentDate())

    const sunWorld = mat4.fromScaling(mat4.create(), [SUN_VISUAL_RADIUS, SUN_VISUAL_RADIUS, SUN_VISUAL_RADIUS])
    const sunWVP = mat4.multiply(mat4.create(), projection, mat4.multiply(mat4.create(), view, sunWorld))
    const sunUniforms = new Float32Array(20)
    sunUniforms.set(sunWVP, 0)
    sunUniforms.set([1.0, 0.9, 0.6, 1.0], 16)
    device.queue.writeBuffer(sunUniformBuffer, 0, sunUniforms)

    const earthWorld = mat4.multiply(
      mat4.create(),
      mat4.fromTranslation(mat4.create(), earthPosition),
      mat4.fromScaling(mat4.create(), [EARTH_VISUAL_RADIUS, EARTH_VISUAL_RADIUS, EARTH_VISUAL_RADIUS]),
    )
    const earthWVP = mat4.multiply(mat4.create(), projection, mat4.multiply(mat4.create(), view, earthWorld))
    const lightDirection = vec3.normalize(vec3.create(), vec3.subtract(vec3.create(), earthPosition, sunPosition))
    const earthUniforms = new Float32Array(40)
    earthUniforms.set(earthWVP, 0)
    earthUniforms.set(earthWorld, 16)
    earthUniforms.set([0.25, 0.45, 0.75, 1.0], 32)
    earthUniforms.set([...lightDirection, 0], 36)
    device.queue.writeBuffer(earthUniformBuffer, 0, earthUniforms)

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
    drawBody(pass, unlitPipeline, meshBuffers, sunBindGroup)
    drawBody(pass, litPipeline, meshBuffers, earthBindGroup)
    pass.end()
    device.queue.submit([encoder.finish()])
    canvas.dataset.rendered = 'true'
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}

main().catch((error) => {
  const canvas = document.querySelector<HTMLCanvasElement>('#scene')
  if (canvas) canvas.replaceWith(document.createTextNode(`Failed to start renderer: ${error.message}`))
  console.error(error)
})
