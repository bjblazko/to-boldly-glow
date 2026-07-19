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
import { generateOrbitPathPositions } from './solarSystem/orbitPath'
import { worldToScreen, type ScreenPosition } from './renderer/screenProjection'
import { computeCanvasSize } from './renderer/canvasSize'
import {
  createLinePipeline,
  createLitPipeline,
  createMeshBuffers,
  createOrbitPathBuffer,
  createRenderTargets,
  createUnlitPipeline,
  initWebGpu,
  updateOrbitPathBuffer,
  type MeshBuffers,
} from './renderer/webgpu'

function requireElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector)
  if (!element) throw new Error(`Required element ${selector} not found.`)
  return element
}

// Resizes the canvas's backing store to match its CSS-determined display size (see
// computeCanvasSize). Returns false without touching the canvas if the size hasn't changed, so
// callers can cheaply skip recreating size-dependent GPU resources on every resize event.
function resizeCanvasIfNeeded(canvas: HTMLCanvasElement): boolean {
  const { width, height } = computeCanvasSize(canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio || 1)
  if (canvas.width === width && canvas.height === height) return false
  canvas.width = width
  canvas.height = height
  return true
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
  resizeCanvasIfNeeded(canvas)

  const { device, context, format } = await initWebGpu(canvas)
  let { depthTexture, multisampleColorTexture } = createRenderTargets(device, format, canvas.width, canvas.height)
  const litPipeline = await createLitPipeline(device, format)
  const unlitPipeline = await createUnlitPipeline(device, format)

  const sphereMesh = generateSphereMesh(1, 32, 32)
  const meshBuffers = createMeshBuffers(device, sphereMesh)

  const sunRenderable = createBodyRenderable(device, unlitPipeline, SUN, 20)
  const planetRenderables = PLANETS.map((planet) => createBodyRenderable(device, litPipeline, planet, 40))

  // Starts fully "Explorer" (1) for a legible initial view — at "Realistic" (0), the inner
  // planets are indistinguishable from the Sun at any reasonable camera distance. The slider
  // lets the user dial toward "Realistic" to see true relative scale/distance.
  let scaleBlend = 1

  const linePipeline = await createLinePipeline(device, format)

  interface OrbitPathRenderable {
    definition: BodyDefinition
    vertexBuffer: GPUBuffer
    uniformBuffer: GPUBuffer
    bindGroup: GPUBindGroup
  }

  const orbitPathRenderables: OrbitPathRenderable[] = PLANETS.map((planet) => {
    const vertexBuffer = createOrbitPathBuffer(device, generateOrbitPathPositions(planet, scaleBlend))
    const uniformBuffer = device.createBuffer({
      label: `${planet.id} orbit path uniforms`,
      size: 20 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })
    const bindGroup = device.createBindGroup({
      layout: linePipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
    })
    return { definition: planet, vertexBuffer, uniformBuffer, bindGroup }
  })

  let showOrbitPaths = true

  function refreshOrbitPaths(): void {
    for (const path of orbitPathRenderables) {
      updateOrbitPathBuffer(device, path.vertexBuffer, generateOrbitPathPositions(path.definition, scaleBlend))
    }
  }

  const scaleSlider = requireElement<HTMLInputElement>('#scale-slider')
  scaleSlider.addEventListener('input', () => {
    scaleBlend = Number(scaleSlider.value) / 100
    canvas.dataset.scaleBlend = String(scaleBlend)
    refreshOrbitPaths()
  })

  const orbitPathsToggle = requireElement<HTMLInputElement>('#orbit-paths-toggle')
  orbitPathsToggle.addEventListener('change', () => {
    showOrbitPaths = orbitPathsToggle.checked
    canvas.dataset.orbitPaths = String(showOrbitPaths)
  })

  const labelsContainer = requireElement<HTMLDivElement>('#body-labels')
  const labelElements = new Map<string, HTMLDivElement>()
  for (const body of [SUN, ...PLANETS]) {
    const label = document.createElement('div')
    label.className = 'body-label'
    label.textContent = body.name
    label.style.position = 'absolute'
    label.style.transform = 'translate(-50%, 4px)'
    label.style.color = 'white'
    label.style.font = '12px sans-serif'
    label.style.textShadow = '0 0 3px black, 0 0 3px black'
    label.style.whiteSpace = 'nowrap'
    labelsContainer.appendChild(label)
    labelElements.set(body.id, label)
  }

  function updateLabelPosition(label: HTMLDivElement, screen: ScreenPosition): void {
    if (!screen.visible) {
      label.style.display = 'none'
      return
    }
    label.style.display = ''
    label.style.left = `${screen.x}px`
    label.style.top = `${screen.y}px`
  }

  let showBodyLabels = true
  const bodyLabelsToggle = requireElement<HTMLInputElement>('#body-labels-toggle')
  bodyLabelsToggle.addEventListener('change', () => {
    showBodyLabels = bodyLabelsToggle.checked
    labelsContainer.style.display = showBodyLabels ? '' : 'none'
    canvas.dataset.labelsVisible = String(showBodyLabels)
  })

  let projection = mat4.perspective(mat4.create(), Math.PI / 4, canvas.width / canvas.height, 0.1, 1000)

  // The depth/MSAA textures and the projection matrix's aspect ratio are both tied to the
  // canvas's backing-store size, which computeCanvasSize/resizeCanvasIfNeeded derive from the
  // canvas's CSS display size (see index.html, where #scene fills its viewport-sized wrapper).
  // WebGPU's canvas swap-chain texture (`context.getCurrentTexture()`) tracks canvas.width/height
  // automatically and needs no such handling.
  window.addEventListener('resize', () => {
    if (!resizeCanvasIfNeeded(canvas)) return
    depthTexture.destroy()
    multisampleColorTexture.destroy()
    ;({ depthTexture, multisampleColorTexture } = createRenderTargets(device, format, canvas.width, canvas.height))
    projection = mat4.perspective(mat4.create(), Math.PI / 4, canvas.width / canvas.height, 0.1, 1000)
  })

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
    const T = currentJulianMillennia(simulationClock.getCurrentDate())
    const viewProjection = mat4.multiply(mat4.create(), projection, view)

    const sunRadius = scaledBodyRadiusUnits(SUN.radiusKm, SUN.explorerVisualRadius, scaleBlend, AU_KM)
    const sunWorld = mat4.fromScaling(mat4.create(), [sunRadius, sunRadius, sunRadius])
    const sunWVP = mat4.multiply(mat4.create(), projection, mat4.multiply(mat4.create(), view, sunWorld))
    const sunUniforms = new Float32Array(20)
    sunUniforms.set(sunWVP, 0)
    sunUniforms.set([...SUN.color, 1.0], 16)
    device.queue.writeBuffer(sunRenderable.uniformBuffer, 0, sunUniforms)

    if (showBodyLabels) {
      const sunScreen = worldToScreen(viewProjection, 0, 0, 0, canvas.width, canvas.height)
      updateLabelPosition(labelElements.get(SUN.id)!, sunScreen)
    }

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

      if (showBodyLabels) {
        const screen = worldToScreen(viewProjection, sx, sy, sz, canvas.width, canvas.height)
        updateLabelPosition(labelElements.get(renderable.definition.id)!, screen)
      }
    }

    if (showOrbitPaths) {
      for (const path of orbitPathRenderables) {
        const uniforms = new Float32Array(20)
        uniforms.set(viewProjection, 0)
        uniforms.set([...path.definition.color, 0.5], 16)
        device.queue.writeBuffer(path.uniformBuffer, 0, uniforms)
      }
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
    if (showOrbitPaths) {
      pass.setPipeline(linePipeline)
      for (const path of orbitPathRenderables) {
        pass.setVertexBuffer(0, path.vertexBuffer)
        pass.setBindGroup(0, path.bindGroup)
        pass.draw(129) // ORBIT_PATH_SEGMENTS + 1 points, see orbitPath.ts
      }
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
