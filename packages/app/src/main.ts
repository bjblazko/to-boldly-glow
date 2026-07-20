import { mat4, vec3 } from 'gl-matrix'
import { daysSinceJ2000, julianMillenniaSinceJ2000 } from '@toboldlyglow/engine'
import { generateSphereMesh } from './geometry/sphere'
import { generateRingMesh } from './geometry/ring'
import { minOrbitRadiusForBlend, OrbitCamera } from './camera/orbitCamera'
import { FlyCamera } from './camera/flyCamera'
import { CameraInputController } from './camera/inputController'
import { CameraFollowController } from './camera/cameraFollow'
import { currentJulianDay, SimulationClock } from './time/simulationClock'
import { TimeControlUI } from './time/timeControlUI'
import { AU_KM, PLANETS, SUN, type BodyDefinition } from './solarSystem/bodies'
import { planetAuPosition } from './solarSystem/entities'
import { EntitySearchUI } from './search/entitySearchUI'
import { DockUI } from './hud/dockUI'
import { initShuttleVisual } from './hud/shuttleVisual'
import { scaledBodyRadiusUnits, scaledPosition } from './solarSystem/sceneScale'
import { generateOrbitPathPositions } from './solarSystem/orbitPath'
import { rotationAngleRadians } from './solarSystem/rotation'
import { axisAlignmentRotation, equatorialToEclipticPoleDirection } from './solarSystem/poleOrientation'
import { MOONS } from './solarSystem/moons'
import {
  moonFlatOrbitPosition,
  moonOrbitAngleRadians,
  moonOrbitPlaneTiltMatrix,
  moonOrbitReferencePoleDirection,
  moonRotationAngleRadians,
  scaledMoonOrbitRadiusUnits,
} from './solarSystem/moonOrbit'
import { worldToScreen, type ScreenPosition } from './renderer/screenProjection'
import { computeCanvasSize } from './renderer/canvasSize'
import {
  createBodySampler,
  createFlarePipeline,
  createLinePipeline,
  createLitPipeline,
  createMeshBuffers,
  createOrbitPathBuffer,
  createRenderTargets,
  createRingBuffers,
  createRingPipeline,
  createStarBuffer,
  createStarPipeline,
  createUnlitPipeline,
  initWebGpu,
  updateOrbitPathBuffer,
  type MeshBuffers,
} from './renderer/webgpu'
import { createFallbackWhiteTexture, loadBodyTexture } from './renderer/textureLoader'
import { loadStarCatalog } from './starfield/starCatalog'
import {
  createBloomPipelines,
  createBloomTargets,
  destroyBloomTargets,
  runBloomAndComposite,
  type BloomPipelines,
  type BloomTargets,
} from './renderer/postProcessing'

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

// Sun texture/color samples are clamped to [0,1] like any other body's, so left alone the Sun
// would never exceed the bloom pass's brightness threshold. Boosting it here — applied only to
// the uniform written into the HDR scene buffer, not to any stored body data — is what makes it
// bloom once tonemapped back down; see renderer/shaders.ts's brightPassShaderCode for the
// threshold this needs to clear.
const SUN_BLOOM_INTENSITY = 4.0

// The non-bloom fallback path writes this directly to the (non-sRGB) swapchain, so it's the
// actual displayed color. The bloom path's composite pass gamma-encodes its output afterward
// (see brightPassShaderCode's sibling, bloomCompositeShaderCode), so its HDR clear value here is
// pre-linearized (raised to the 2.2 gamma power) to reproduce the same displayed dark-navy color
// once that encode is applied — otherwise the background would look washed-out gray instead of
// near-black, since gamma-encoding a "moderate" linear value like 0.02 brightens it substantially.
const DIRECT_BACKGROUND_CLEAR_VALUE: GPUColorDict = { r: 0.02, g: 0.02, b: 0.05, a: 1 }
const HDR_BACKGROUND_CLEAR_VALUE: GPUColorDict = { r: 0.02 ** 2.2, g: 0.02 ** 2.2, b: 0.05 ** 2.2, a: 1 }

// Lens-flare sprites: an anamorphic horizontal streak through the Sun's own screen position,
// plus several aperture-blade "ghost" artifacts along the line from the Sun through screen center
// (t=0.5 lands exactly on center; t>0.5 overshoots to the mirrored side) — the classic
// real-lens-flare placement. bladeCount is the aperture polygon's side count (a real camera's iris
// shape); 0 selects the anamorphic-streak shape instead of a polygon. Sizes are in pixels.
interface FlareSpec {
  widthPx: number
  heightPx: number
  color: [number, number, number, number]
  t: number
  bladeCount: number
  rotation: number
}
const FLARE_SPECS: FlareSpec[] = [
  { widthPx: 800, heightPx: 4, color: [0.65, 0.8, 1.0, 0.5], t: 0, bladeCount: 0, rotation: 0 },
  { widthPx: 90, heightPx: 90, color: [1.0, 0.85, 0.55, 0.4], t: 0, bladeCount: 8, rotation: 0.3 },
  { widthPx: 34, heightPx: 34, color: [0.55, 0.75, 1.0, 0.35], t: 0.6, bladeCount: 6, rotation: 0.5 },
  { widthPx: 50, heightPx: 50, color: [1.0, 0.6, 0.35, 0.3], t: 1.15, bladeCount: 9, rotation: -0.2 },
  { widthPx: 22, heightPx: 22, color: [0.7, 1.0, 0.85, 0.28], t: 1.5, bladeCount: 5, rotation: 0.8 },
]

interface BodyRenderable<TDefinition extends { id: string } = BodyDefinition> {
  definition: TDefinition
  uniformBuffer: GPUBuffer
  bindGroup: GPUBindGroup
}

// Generic over the definition type so it works for both planets/Sun (BodyDefinition, always has a
// textureUrl) and moons (MoonDefinition, textureUrl optional — see solarSystem/moons.ts for why
// some moons have none).
async function createBodyRenderable<TDefinition extends { id: string; textureUrl?: string }>(
  device: GPUDevice,
  pipeline: GPURenderPipeline,
  definition: TDefinition,
  uniformFloatCount: number,
  sampler: GPUSampler,
): Promise<BodyRenderable<TDefinition>> {
  const uniformBuffer = device.createBuffer({
    label: `${definition.id} uniforms`,
    size: uniformFloatCount * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })
  const texture = definition.textureUrl
    ? await loadBodyTexture(device, definition.textureUrl)
    : createFallbackWhiteTexture(device)
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: texture.createView() },
      { binding: 2, resource: sampler },
    ],
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

  // Bloom/HDR post-processing is core (non-optional-feature) WebGPU functionality, but its setup
  // is still wrapped defensively: a failure here degrades to the pre-bloom direct-to-swapchain
  // path (see the `bloomSupported` branch below and in frame()) rather than blocking the app, in
  // the same spirit as the texture/star-catalog load failures elsewhere (see docs/superpowers/
  // specs/2026-07-17-to-boldly-glow-mvp-design.md §6). This must run before the scene's own
  // pipelines are created, since they need to target the HDR format when bloom is active.
  let bloomSupported = true
  let bloomPipelines: BloomPipelines | null = null
  let bloomTargets: BloomTargets | null = null
  try {
    bloomPipelines = await createBloomPipelines(device, format)
    bloomTargets = createBloomTargets(device, bloomPipelines, canvas.width, canvas.height)
  } catch (error) {
    console.warn('Bloom post-processing unavailable, falling back to direct rendering.', error)
    bloomSupported = false
  }
  canvas.dataset.bloomSupported = String(bloomSupported)

  // The scene's own pipelines (bodies, stars, orbit lines) render into this format: the HDR
  // resolve target when bloom is active, or the swapchain format directly otherwise. Only
  // renderer/postProcessing.ts's composite pass ever targets the true swapchain format.
  const sceneColorFormat: GPUTextureFormat = bloomSupported ? 'rgba16float' : format

  const litPipeline = await createLitPipeline(device, sceneColorFormat)
  const unlitPipeline = await createUnlitPipeline(device, sceneColorFormat)

  const sphereMesh = generateSphereMesh(1, 32, 32)
  const meshBuffers = createMeshBuffers(device, sphereMesh)
  const bodySampler = createBodySampler(device)

  const sunRenderable = await createBodyRenderable(device, unlitPipeline, SUN, 20, bodySampler)
  const planetRenderables = await Promise.all(
    PLANETS.map((planet) => createBodyRenderable(device, litPipeline, planet, 44, bodySampler)),
  )
  const moonRenderables = await Promise.all(
    MOONS.map((moon) => createBodyRenderable(device, litPipeline, moon, 44, bodySampler)),
  )
  canvas.dataset.texturesLoaded = 'true'

  const starPipeline = await createStarPipeline(device, sceneColorFormat)
  const starCatalog = await loadStarCatalog('/stars/starCatalog.bin')
  const starBuffer = createStarBuffer(device, starCatalog)
  const starCount = starCatalog.length / 4
  canvas.dataset.starCount = String(starCount)
  const starUniformBuffer = device.createBuffer({
    label: 'star uniforms',
    size: 20 * 4, // mat4x4f (16) + vec2f (2), padded to a 16-byte-aligned struct size
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })
  const starBindGroup = device.createBindGroup({
    layout: starPipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: starUniformBuffer } }],
  })

  let showStarfield = true
  const starfieldToggle = requireElement<HTMLInputElement>('#starfield-toggle')
  starfieldToggle.addEventListener('change', () => {
    showStarfield = starfieldToggle.checked
    canvas.dataset.starfield = String(showStarfield)
  })

  // Only meaningful when bloomSupported — see how it feeds SUN_BLOOM_INTENSITY in frame() below.
  let showBloom = true
  if (bloomSupported) {
    const bloomToggle = requireElement<HTMLInputElement>('#bloom-toggle')
    bloomToggle.addEventListener('change', () => {
      showBloom = bloomToggle.checked
      canvas.dataset.bloom = String(showBloom)
    })
    canvas.dataset.bloom = String(showBloom)
  }

  // Independent of showBloom/bloomSupported — the flare pipeline is a depth-tested screen-space
  // billboard technique that doesn't depend on the HDR/bloom pipeline at all, so it stays
  // available (and toggleable) even when bloom itself is unsupported or turned off.
  let showFlares = true
  const flaresToggle = requireElement<HTMLInputElement>('#flares-toggle')
  flaresToggle.addEventListener('change', () => {
    showFlares = flaresToggle.checked
    canvas.dataset.flares = String(showFlares)
  })

  let showMoons = true
  const moonsToggle = requireElement<HTMLInputElement>('#moons-toggle')
  moonsToggle.addEventListener('change', () => {
    showMoons = moonsToggle.checked
    canvas.dataset.moons = String(showMoons)
  })

  const flarePipeline = await createFlarePipeline(device, sceneColorFormat)
  const flareRenderables = FLARE_SPECS.map((spec, index) => {
    const uniformBuffer = device.createBuffer({
      label: `flare ${index} uniforms`,
      size: 12 * 4, // color (4) + ndcCenter (2) + sizeNdc (2) + ndcDepth (1), padded to 12 floats
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })
    const bindGroup = device.createBindGroup({
      layout: flarePipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
    })
    return { spec, uniformBuffer, bindGroup }
  })

  // Saturn's rings: a flat annulus, unit-relative to a sphere of radius 1 (same convention as
  // generateSphereMesh(1, ...)), so it scales exactly like Saturn's own sphere across the
  // Realistic/Explorer slider. Real ring extent is roughly 1.1-2.3 Saturn radii; not modeled per
  // body, since Saturn is the only planet with a visible ring system.
  const ringPipeline = await createRingPipeline(device, sceneColorFormat)
  const ringMesh = generateRingMesh(1.3, 2.3, 128)
  const ringBuffers = createRingBuffers(device, ringMesh)
  const ringTexture = await loadBodyTexture(device, '/textures/saturn_ring.png')
  const ringUniformBuffer = device.createBuffer({
    label: 'saturn ring uniforms',
    size: 36 * 4, // worldViewProjection (16) + world (16) + lightDirection (4)
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })
  const ringBindGroup = device.createBindGroup({
    layout: ringPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: ringUniformBuffer } },
      { binding: 1, resource: ringTexture.createView() },
      { binding: 2, resource: bodySampler },
    ],
  })
  // Starts fully "Explorer" (1) for a legible initial view — at "Realistic" (0), the inner
  // planets are indistinguishable from the Sun at any reasonable camera distance. The slider
  // lets the user dial toward "Realistic" to see true relative scale/distance.
  let scaleBlend = 1

  // elevation was 0.4 rad under the old (incorrect) Y-up convention, where azimuth=0 happened to
  // put most of the eye offset along the scene's real north (Z) by coincidence of the old
  // hardcoded formula - see docs/superpowers/specs/2026-07-20-camera-north-up-orientation-design.md
  // #1 and #3.2. That accidental view sat ~23 degrees off true north, i.e. ~67 degrees of true
  // elevation above the real ecliptic plane. Now that elevation is measured against the real
  // up-axis (ECLIPTIC_NORTH by default), 67 degrees reproduces the same-looking default view
  // under the corrected semantics.
  const orbitCamera = new OrbitCamera({ radius: 65, azimuth: 0, elevation: (67 * Math.PI) / 180 })

  const linePipeline = await createLinePipeline(device, sceneColorFormat)

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

  // Keeps the camera's zoom-in floor proportional to the current scale, so a body's own close-up
  // framing (see defaultFramingRadius in cameraFollow.ts) is never overridden by an
  // Explorer-appropriate minimum distance that's now orders of magnitude too large.
  function refreshCameraZoomLimits(): void {
    orbitCamera.minRadius = minOrbitRadiusForBlend(scaleBlend)
  }
  refreshCameraZoomLimits()

  const scaleSlider = requireElement<HTMLInputElement>('#scale-slider')
  scaleSlider.addEventListener('input', () => {
    scaleBlend = Number(scaleSlider.value) / 100
    canvas.dataset.scaleBlend = String(scaleBlend)
    refreshOrbitPaths()
    refreshCameraZoomLimits()
    // The near clip plane is derived from orbitCamera.minRadius (see nearPlaneDistance), which
    // refreshCameraZoomLimits just updated - rebuild the projection matrix to match.
    projection = mat4.perspective(mat4.create(), Math.PI / 4, canvas.width / canvas.height, nearPlaneDistance(), 1000)
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
  for (const moon of MOONS) {
    const label = document.createElement('div')
    label.className = 'moon-label'
    label.textContent = moon.name
    label.style.position = 'absolute'
    label.style.transform = 'translate(-50%, 4px)'
    label.style.color = 'rgba(255, 255, 255, 0.75)'
    label.style.font = '10px sans-serif'
    label.style.textShadow = '0 0 3px black, 0 0 3px black'
    label.style.whiteSpace = 'nowrap'
    labelsContainer.appendChild(label)
    labelElements.set(moon.id, label)
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

  // The near clip plane must stay closer than the camera's own closest-possible zoom distance
  // (orbitCamera.minRadius), or the camera clips away exactly the body it's trying to frame -
  // e.g. at Realistic scale, orbitCamera.minRadius shrinks to ~0.0005 units (see
  // minOrbitRadiusForBlend in orbitCamera.ts), so a fixed near plane of 0.1 (tuned for
  // Explorer-scale zoom) would clip away everything the camera gets close enough to actually
  // resolve. 0.02 reproduces today's Explorer-mode near plane exactly (5 * 0.02 = 0.1) while
  // shrinking proportionally at smaller blends.
  const NEAR_PLANE_FRACTION_OF_MIN_RADIUS = 0.02
  function nearPlaneDistance(): number {
    return orbitCamera.minRadius * NEAR_PLANE_FRACTION_OF_MIN_RADIUS
  }

  let projection = mat4.perspective(mat4.create(), Math.PI / 4, canvas.width / canvas.height, nearPlaneDistance(), 1000)

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
    if (bloomSupported && bloomPipelines) {
      destroyBloomTargets(bloomTargets!)
      bloomTargets = createBloomTargets(device, bloomPipelines, canvas.width, canvas.height)
    }
    projection = mat4.perspective(mat4.create(), Math.PI / 4, canvas.width / canvas.height, nearPlaneDistance(), 1000)
  })

  const flyCamera = new FlyCamera({ position: [0, 25, 60], yaw: Math.PI, pitch: 0 })
  const cameraInput = new CameraInputController(canvas, orbitCamera, flyCamera)

  const modeToggleButton = document.querySelector<HTMLButtonElement>('#camera-mode-toggle')
  const modeToggleLabel = modeToggleButton?.querySelector<HTMLElement>('.btn-label')
  function setCameraMode(mode: 'orbit' | 'fly') {
    cameraInput.setMode(mode)
    if (modeToggleLabel) {
      modeToggleLabel.textContent = mode === 'orbit' ? 'Switch to Free-fly Camera' : 'Switch to Orbit Camera'
    }
  }
  modeToggleButton?.addEventListener('click', () => {
    setCameraMode(cameraInput.mode === 'orbit' ? 'fly' : 'orbit')
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

  new DockUI(
    document.querySelectorAll<HTMLButtonElement>('.hud-dock-btn'),
    requireElement<HTMLElement>('#hud-sheet'),
    document.querySelectorAll<HTMLElement>('.hud-sheet-panel'),
  )
  initShuttleVisual(requireElement<HTMLInputElement>('#time-shuttle'), requireElement<HTMLElement>('#time-shuttle-fill'))

  const cameraFollow = new CameraFollowController(orbitCamera)
  const entitySearchUI = new EntitySearchUI(
    requireElement<HTMLInputElement>('#entity-search-input'),
    requireElement<HTMLDivElement>('#entity-search-results'),
    requireElement<HTMLElement>('#follow-indicator'),
    requireElement<HTMLElement>('#follow-indicator-label'),
    requireElement<HTMLButtonElement>('#follow-stop-button'),
    (entity) => {
      if (cameraInput.mode === 'fly') setCameraMode('orbit')
      const julianDay = currentJulianDay(simulationClock.getCurrentDate())
      const T = julianMillenniaSinceJ2000(julianDay)
      const daysSinceEpoch = daysSinceJ2000(julianDay)
      cameraFollow.selectEntity(entity, T, daysSinceEpoch, scaleBlend)
      canvas.dataset.followingId = entity.id
      entitySearchUI.setFollowing(entity)
    },
    () => {
      cameraFollow.stopFollowing()
      delete canvas.dataset.followingId
      entitySearchUI.setFollowing(null)
    },
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
    pass.setVertexBuffer(2, buffers.uvBuffer)
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

    const currentDate = simulationClock.getCurrentDate()
    const julianDay = currentJulianDay(currentDate)
    const T = julianMillenniaSinceJ2000(julianDay)
    const daysSinceEpoch = daysSinceJ2000(julianDay)
    // Must run before getViewMatrix() below, so a followed entity's target reflects this frame's
    // position rather than the previous frame's.
    cameraFollow.update(deltaSeconds, T, daysSinceEpoch, scaleBlend)

    const view = cameraInput.getViewMatrix()
    // A view matrix's translation column isn't the eye position directly (it's rotated into view
    // space), so extract it by inverting instead — works identically for both orbit and fly mode
    // without either camera class needing to expose its own position.
    const cameraPosition = mat4.getTranslation(vec3.create(), mat4.invert(mat4.create(), view) ?? mat4.create())
    const viewProjection = mat4.multiply(mat4.create(), projection, view)

    if (showStarfield) {
      // Strip the view matrix's translation (column 4: indices 12-14) so the star field rotates
      // with the camera but never translates with it, like an infinitely distant skybox.
      const viewRotationOnly = mat4.clone(view)
      viewRotationOnly[12] = 0
      viewRotationOnly[13] = 0
      viewRotationOnly[14] = 0
      const starViewProjection = mat4.multiply(mat4.create(), projection, viewRotationOnly)
      const starUniforms = new Float32Array(20)
      starUniforms.set(starViewProjection, 0)
      const starSizePx = 3
      starUniforms.set([(starSizePx * 2) / canvas.width, (starSizePx * 2) / canvas.height], 16)
      device.queue.writeBuffer(starUniformBuffer, 0, starUniforms)
    }

    const sunRadius = scaledBodyRadiusUnits(SUN.radiusKm, SUN.explorerVisualRadius, scaleBlend, AU_KM)
    const sunRotation = rotationAngleRadians(daysSinceEpoch, SUN.siderealRotationHours)
    const sunPoleDirection = equatorialToEclipticPoleDirection(SUN.poleRightAscensionDegrees, SUN.poleDeclinationDegrees)
    const sunTilt = axisAlignmentRotation(sunPoleDirection)
    const sunWorld = mat4.multiply(
      mat4.create(),
      sunTilt,
      mat4.multiply(mat4.create(), mat4.fromZRotation(mat4.create(), sunRotation), mat4.fromScaling(mat4.create(), [sunRadius, sunRadius, sunRadius])),
    )
    const sunWVP = mat4.multiply(mat4.create(), projection, mat4.multiply(mat4.create(), view, sunWorld))
    const sunColorMultiplier = bloomSupported && showBloom ? SUN_BLOOM_INTENSITY : 1.0
    const sunUniforms = new Float32Array(20)
    sunUniforms.set(sunWVP, 0)
    sunUniforms.set([...SUN.color.map((c) => c * sunColorMultiplier), 1.0], 16)
    device.queue.writeBuffer(sunRenderable.uniformBuffer, 0, sunUniforms)

    // The Sun always sits at the world origin, so its clip-space position simplifies to just the
    // view-projection matrix's translation column (see worldToScreen for the general case this
    // specializes). sunClipW <= 0 means the Sun is behind the camera; skip the flare entirely then.
    const sunClipW = viewProjection[15]
    const sunFlareVisible = showFlares && sunClipW > 0
    if (sunFlareVisible) {
      const sunNdcX = viewProjection[12] / sunClipW
      const sunNdcY = viewProjection[13] / sunClipW
      const sunNdcZ = viewProjection[14] / sunClipW
      for (const flare of flareRenderables) {
        const { widthPx, heightPx, color, t, bladeCount, rotation } = flare.spec
        const mirrorFactor = 1 - 2 * t
        const flareUniforms = new Float32Array(12)
        flareUniforms.set(color, 0)
        flareUniforms.set([sunNdcX * mirrorFactor, sunNdcY * mirrorFactor], 4)
        flareUniforms.set([(widthPx * 2) / canvas.width, (heightPx * 2) / canvas.height], 6)
        flareUniforms.set([sunNdcZ, bladeCount, rotation], 8)
        device.queue.writeBuffer(flare.uniformBuffer, 0, flareUniforms)
      }
    }

    if (showBodyLabels) {
      // Label positions feed CSS `left`/`top` on DOM elements, so they need CSS pixels
      // (clientWidth/clientHeight), not the canvas's backing-store pixels (canvas.width/height,
      // which include devicePixelRatio scaling and would place every label off by that factor —
      // e.g. exactly 2x too far right/down on a devicePixelRatio:2 display, pushing most labels
      // outside the label container's bounds).
      const sunScreen = worldToScreen(viewProjection, 0, 0, 0, canvas.clientWidth, canvas.clientHeight)
      updateLabelPosition(labelElements.get(SUN.id)!, sunScreen)
    }

    const planetPositionsById = new Map<string, [number, number, number]>()
    for (const renderable of planetRenderables) {
      const { x, y, z, distanceAu } = planetAuPosition(renderable.definition, T)
      const [sx, sy, sz] = scaledPosition(x, y, z, distanceAu, scaleBlend)
      planetPositionsById.set(renderable.definition.id, [sx, sy, sz])
      const radius = scaledBodyRadiusUnits(
        renderable.definition.radiusKm,
        renderable.definition.explorerVisualRadius,
        scaleBlend,
        AU_KM,
      )
      const rotation = rotationAngleRadians(daysSinceEpoch, renderable.definition.siderealRotationHours)
      const poleDirection = equatorialToEclipticPoleDirection(
        renderable.definition.poleRightAscensionDegrees,
        renderable.definition.poleDeclinationDegrees,
      )
      const tilt = axisAlignmentRotation(poleDirection)
      const world = mat4.multiply(
        mat4.create(),
        mat4.fromTranslation(mat4.create(), [sx, sy, sz]),
        mat4.multiply(
          mat4.create(),
          tilt,
          mat4.multiply(mat4.create(), mat4.fromZRotation(mat4.create(), rotation), mat4.fromScaling(mat4.create(), [radius, radius, radius])),
        ),
      )
      const wvp = mat4.multiply(mat4.create(), projection, mat4.multiply(mat4.create(), view, world))
      const lightDirection = vec3.normalize(vec3.create(), vec3.fromValues(sx, sy, sz))
      const uniforms = new Float32Array(44)
      uniforms.set(wvp, 0)
      uniforms.set(world, 16)
      uniforms.set([...renderable.definition.color, 1.0], 32)
      uniforms.set([...lightDirection, 0], 36)
      uniforms.set([...cameraPosition, 0], 40)
      device.queue.writeBuffer(renderable.uniformBuffer, 0, uniforms)

      if (renderable.definition.id === 'saturn') {
        const ringWorld = mat4.multiply(
          mat4.create(),
          mat4.fromTranslation(mat4.create(), [sx, sy, sz]),
          mat4.multiply(mat4.create(), tilt, mat4.fromScaling(mat4.create(), [radius, radius, radius])),
        )
        const ringWvp = mat4.multiply(mat4.create(), projection, mat4.multiply(mat4.create(), view, ringWorld))
        const ringUniforms = new Float32Array(36)
        ringUniforms.set(ringWvp, 0)
        ringUniforms.set(ringWorld, 16)
        ringUniforms.set([...lightDirection, 0], 32)
        device.queue.writeBuffer(ringUniformBuffer, 0, ringUniforms)
      }

      if (showBodyLabels) {
        const screen = worldToScreen(viewProjection, sx, sy, sz, canvas.clientWidth, canvas.clientHeight)
        updateLabelPosition(labelElements.get(renderable.definition.id)!, screen)
      }
    }

    if (showMoons) {
      for (const renderable of moonRenderables) {
        const moon = renderable.definition
        const parentPosition = planetPositionsById.get(moon.parentId)
        if (!parentPosition) continue
        const angle = moonOrbitAngleRadians(daysSinceEpoch, moon.siderealOrbitPeriodDays)
        const orbitRadius = scaledMoonOrbitRadiusUnits(moon.orbitDistanceKm, moon.explorerOrbitVisualRadius, scaleBlend, AU_KM)
        const parentDefinition = PLANETS.find((p) => p.id === moon.parentId) as BodyDefinition
        const referencePoleDirection = moonOrbitReferencePoleDirection(moon, parentDefinition)
        const moonTilt = moonOrbitPlaneTiltMatrix(
          moon.orbitInclinationToParentEquatorDegrees,
          moon.orbitAscendingNodeDegrees,
          referencePoleDirection,
        )
        const [rx, ry, rz] = vec3.transformMat4(vec3.create(), moonFlatOrbitPosition(orbitRadius, angle), moonTilt)
        const [px, py, pz] = parentPosition
        const [sx, sy, sz] = [px + rx, py + ry, pz + rz]
        const radius = scaledBodyRadiusUnits(moon.radiusKm, moon.explorerVisualRadius, scaleBlend, AU_KM)
        // Tidally locked (true of every moon in this set): rotation tracks the orbital angle
        // directly under this local-Z-spin convention (see moonRotationAngleRadians), and the
        // SAME moonTilt matrix used for position is reused here, so tidal lock holds regardless
        // of the orbital plane's real 3D tilt.
        const rotation = moonRotationAngleRadians(angle)
        const world = mat4.multiply(
          mat4.create(),
          mat4.fromTranslation(mat4.create(), [sx, sy, sz]),
          mat4.multiply(
            mat4.create(),
            moonTilt,
            mat4.multiply(mat4.create(), mat4.fromZRotation(mat4.create(), rotation), mat4.fromScaling(mat4.create(), [radius, radius, radius])),
          ),
        )
        const wvp = mat4.multiply(mat4.create(), projection, mat4.multiply(mat4.create(), view, world))
        const lightDirection = vec3.normalize(vec3.create(), vec3.fromValues(sx, sy, sz))
        const uniforms = new Float32Array(44)
        uniforms.set(wvp, 0)
        uniforms.set(world, 16)
        uniforms.set([...moon.color, 1.0], 32)
        uniforms.set([...lightDirection, 0], 36)
        uniforms.set([...cameraPosition, 0], 40)
        device.queue.writeBuffer(renderable.uniformBuffer, 0, uniforms)

        if (showBodyLabels) {
          const screen = worldToScreen(viewProjection, sx, sy, sz, canvas.clientWidth, canvas.clientHeight)
          updateLabelPosition(labelElements.get(moon.id)!, screen)
        }
      }
    } else {
      // Otherwise a moon's label would freeze at its last position (still visible) instead of
      // disappearing the moment moons are hidden, since nothing would update it again.
      for (const moon of MOONS) {
        labelElements.get(moon.id)!.style.display = 'none'
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
    // When bloom is supported, the main scene renders into the HDR targets (resolved to a
    // sampleable texture, not the swapchain) and runBloomAndComposite does the only write to the
    // swapchain afterward. Otherwise this falls back to the pre-bloom direct-to-swapchain resolve.
    const sceneColorView =
      bloomSupported && bloomTargets ? bloomTargets.hdrMultisampleTexture.createView() : multisampleColorTexture.createView()
    const sceneResolveTarget =
      bloomSupported && bloomTargets ? bloomTargets.hdrResolveTexture.createView() : context.getCurrentTexture().createView()
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: sceneColorView,
          resolveTarget: sceneResolveTarget,
          clearValue:
            bloomSupported && bloomTargets ? HDR_BACKGROUND_CLEAR_VALUE : DIRECT_BACKGROUND_CLEAR_VALUE,
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
    if (showStarfield) {
      // Drawn first: no depth test in the star pipeline, so correctness relies on draw order —
      // opaque bodies/lines painted afterward naturally occlude any star pixels behind them.
      pass.setPipeline(starPipeline)
      pass.setVertexBuffer(0, starBuffer)
      pass.setBindGroup(0, starBindGroup)
      pass.draw(4, starCount)
    }
    drawBody(pass, unlitPipeline, meshBuffers, sunRenderable.bindGroup)
    for (const renderable of planetRenderables) {
      drawBody(pass, litPipeline, meshBuffers, renderable.bindGroup)
    }
    if (showMoons) {
      for (const renderable of moonRenderables) {
        drawBody(pass, litPipeline, meshBuffers, renderable.bindGroup)
      }
    }
    // Drawn after every opaque sphere (including Saturn's own and any moon) so its depth test
    // correctly hides the portion of the ring that passes behind them.
    pass.setPipeline(ringPipeline)
    pass.setVertexBuffer(0, ringBuffers.positionBuffer)
    pass.setVertexBuffer(1, ringBuffers.uvBuffer)
    pass.setIndexBuffer(ringBuffers.indexBuffer, 'uint32')
    pass.setBindGroup(0, ringBindGroup)
    pass.drawIndexed(ringBuffers.indexCount)
    if (showOrbitPaths) {
      pass.setPipeline(linePipeline)
      for (const path of orbitPathRenderables) {
        pass.setVertexBuffer(0, path.vertexBuffer)
        pass.setBindGroup(0, path.bindGroup)
        pass.draw(129) // ORBIT_PATH_SEGMENTS + 1 points, see orbitPath.ts
      }
    }
    if (sunFlareVisible) {
      // Drawn last, depth-tested against what's already in the depth buffer: any planet in front
      // of the Sun at a given pixel naturally occludes the flare there.
      pass.setPipeline(flarePipeline)
      for (const flare of flareRenderables) {
        pass.setBindGroup(0, flare.bindGroup)
        pass.draw(4)
      }
    }
    pass.end()
    if (bloomSupported && bloomPipelines && bloomTargets) {
      runBloomAndComposite(encoder, bloomPipelines, bloomTargets, context.getCurrentTexture().createView())
    }
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
