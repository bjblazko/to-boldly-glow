import { mat4, vec3 } from 'gl-matrix'
import {
  calendarToJulianDay,
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
import { AU_KM, PLANETS, SUN, type BodyDefinition } from './solarSystem/bodies'
import { scaledBodyRadiusUnits, scaledPosition } from './solarSystem/sceneScale'
import {
  createLitPipeline,
  createMeshBuffers,
  createUnlitPipeline,
  initWebGpu,
  type MeshBuffers,
} from './renderer/webgpu'

function requireElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector)
  if (!element) throw new Error(`Required element ${selector} not found.`)
  return element
}

function currentJulianMillennia(date: Date): number {
  const julianDay = calendarToJulianDay(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate() + date.getUTCHours() / 24,
  )
  return julianMillenniaSinceJ2000(julianDay)
}

// Returns a planet's true AU-space position (unscaled) and its true distance from the Sun.
function planetAuPosition(
  planet: BodyDefinition,
  T: number,
): { x: number; y: number; z: number; distanceAu: number } {
  const position = planet.position
  if (!position) throw new Error(`${planet.id} has no position data.`)
  const longitude = position.longitude(T)
  const latitude = position.latitude(T)
  const distanceAu = position.distance(T)
  return {
    x: sphericalToX(longitude, latitude, distanceAu),
    y: sphericalToY(longitude, latitude, distanceAu),
    z: sphericalToZ(longitude, latitude, distanceAu),
    distanceAu,
  }
}

interface BodyRenderable {
  definition: BodyDefinition
  uniformBuffer: GPUBuffer
  bindGroup: GPUBindGroup
}

function createBodyRenderable(
  device: GPUDevice,
  pipeline: GPURenderPipeline,
  definition: BodyDefinition,
  uniformFloatCount: number,
): BodyRenderable {
  const uniformBuffer = device.createBuffer({
    label: `${definition.id} uniforms`,
    size: uniformFloatCount * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
  })
  return { definition, uniformBuffer, bindGroup }
}

async function main() {
  const canvasElement = document.querySelector<HTMLCanvasElement>('#scene')
  if (!canvasElement) throw new Error('Canvas element #scene not found.')
  const canvas: HTMLCanvasElement = canvasElement
  canvas.width = 800
  canvas.height = 600

  const { device, context, format, depthTexture, multisampleColorTexture } = await initWebGpu(canvas)
  const litPipeline = await createLitPipeline(device, format)
  const unlitPipeline = await createUnlitPipeline(device, format)

  const sphereMesh = generateSphereMesh(1, 32, 32)
  const meshBuffers = createMeshBuffers(device, sphereMesh)

  const sunRenderable = createBodyRenderable(device, unlitPipeline, SUN, 20)
  const planetRenderables = PLANETS.map((planet) => createBodyRenderable(device, litPipeline, planet, 40))

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

  // Temporary hardcoded value — Task 6 wires this to a UI slider (0 = realistic, 1 = explorer).
  const scaleBlend = 1

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
    const T = currentJulianMillennia(simulationClock.getCurrentDate())

    const sunRadius = scaledBodyRadiusUnits(SUN.radiusKm, SUN.explorerVisualRadius, scaleBlend, AU_KM)
    const sunWorld = mat4.fromScaling(mat4.create(), [sunRadius, sunRadius, sunRadius])
    const sunWVP = mat4.multiply(mat4.create(), projection, mat4.multiply(mat4.create(), view, sunWorld))
    const sunUniforms = new Float32Array(20)
    sunUniforms.set(sunWVP, 0)
    sunUniforms.set([...SUN.color, 1.0], 16)
    device.queue.writeBuffer(sunRenderable.uniformBuffer, 0, sunUniforms)

    for (const renderable of planetRenderables) {
      const { x, y, z, distanceAu } = planetAuPosition(renderable.definition, T)
      const [sx, sy, sz] = scaledPosition(x, y, z, distanceAu, scaleBlend)
      const radius = scaledBodyRadiusUnits(
        renderable.definition.radiusKm,
        renderable.definition.explorerVisualRadius,
        scaleBlend,
        AU_KM,
      )
      const world = mat4.multiply(
        mat4.create(),
        mat4.fromTranslation(mat4.create(), [sx, sy, sz]),
        mat4.fromScaling(mat4.create(), [radius, radius, radius]),
      )
      const wvp = mat4.multiply(mat4.create(), projection, mat4.multiply(mat4.create(), view, world))
      const lightDirection = vec3.normalize(vec3.create(), vec3.fromValues(sx, sy, sz))
      const uniforms = new Float32Array(40)
      uniforms.set(wvp, 0)
      uniforms.set(world, 16)
      uniforms.set([...renderable.definition.color, 1.0], 32)
      uniforms.set([...lightDirection, 0], 36)
      device.queue.writeBuffer(renderable.uniformBuffer, 0, uniforms)
    }

    const encoder = device.createCommandEncoder({ label: 'frame encoder' })
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: multisampleColorTexture.createView(),
          resolveTarget: context.getCurrentTexture().createView(),
          clearValue: { r: 0.02, g: 0.02, b: 0.05, a: 1 },
          loadOp: 'clear',
          storeOp: 'discard',
        },
      ],
      depthStencilAttachment: {
        view: depthTexture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
    })
    drawBody(pass, unlitPipeline, meshBuffers, sunRenderable.bindGroup)
    for (const renderable of planetRenderables) {
      drawBody(pass, litPipeline, meshBuffers, renderable.bindGroup)
    }
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
