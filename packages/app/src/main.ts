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
import { LearnModeController } from './learn/learnModeController'
import { LessonPlayer } from './learn/lessonPlayer'
import { LESSONS_BY_ID, SEASONS_LESSON } from './learn/lessons/seasons'
import {
  angleBetweenDirections,
  directedLinePoints,
  equatorRingPoints,
  greatCircleArcPoints,
  latitudeMarkerCenter,
  latitudeMarkerPoints,
  orbitPathCirclePoints,
  orbitPositionForPhase,
  perpendicularComponent,
  rotationAxisPoints,
  tiltAngleArcPoints,
  verticalReferencePoints,
} from './learn/overlayGeometry'
import { initShuttleVisual } from './hud/shuttleVisual'
import { scaledBodyRadiusUnits, scaledPosition } from './solarSystem/sceneScale'
import { ScaleBlendTween } from './solarSystem/scaleBlendTween'
import { easeInOutCubic } from './camera/easing'
import { generateOrbitPathPositions } from './solarSystem/orbitPath'
import { rotationAngleRadians } from './solarSystem/rotation'
import { axisAlignmentRotation, ECLIPTIC_NORTH, equatorialToEclipticPoleDirection } from './solarSystem/poleOrientation'
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
import { CLOUD_SHELL_UNIFORM_FLOAT_COUNT, LINE_UNIFORM_FLOAT_COUNT, LIT_UNIFORM_FLOAT_COUNT } from './renderer/shaders'
import { circleOverlapFraction } from './renderer/circleOverlap'
import { computeCumulativeLineDistances } from './renderer/lineDistance'
import {
  createBodySampler,
  createCloudShellPipeline,
  createFlarePipeline,
  createLinePipeline,
  createLineVertexBuffer,
  createLitPipeline,
  createMeshBuffers,
  createRenderTargets,
  createRingBuffers,
  createRingPipeline,
  createStarBuffer,
  createStarPipeline,
  createUnlitPipeline,
  initWebGpu,
  updateLineVertexBuffer,
  type MeshBuffers,
} from './renderer/webgpu'
import {
  createFallbackFlatBumpTexture,
  createFallbackWhiteTexture,
  loadBodyTexture,
  loadBumpTexture,
} from './renderer/textureLoader'
import { createMipmapPipeline, createMipmapSampler } from './renderer/mipmapGenerator'
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
// shape); 0 selects the anamorphic-streak shape instead of a polygon; -1 selects a soft radial
// corona/halo centered directly on the Sun (t=0, no mirror offset). Sizes are in pixels.
interface FlareSpec {
  widthPx: number
  heightPx: number
  color: [number, number, number, number]
  t: number
  bladeCount: number
  rotation: number
}
const FLARE_SPECS: FlareSpec[] = [
  { widthPx: 260, heightPx: 260, color: [1.0, 0.9, 0.7, 0.35], t: 0, bladeCount: -1, rotation: 0 },
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
async function createBodyRenderable<TDefinition extends { id: string; textureUrl?: string; bumpMapUrl?: string }>(
  device: GPUDevice,
  pipeline: GPURenderPipeline,
  definition: TDefinition,
  uniformFloatCount: number,
  sampler: GPUSampler,
  mipPipeline: GPURenderPipeline,
  mipSampler: GPUSampler,
  fallbackBumpTexture?: GPUTexture,
): Promise<BodyRenderable<TDefinition>> {
  const uniformBuffer = device.createBuffer({
    label: `${definition.id} uniforms`,
    size: uniformFloatCount * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })
  const texture = definition.textureUrl
    ? await loadBodyTexture(device, definition.textureUrl, mipPipeline, mipSampler)
    : createFallbackWhiteTexture(device)
  const entries: GPUBindGroupEntry[] = [
    { binding: 0, resource: { buffer: uniformBuffer } },
    { binding: 1, resource: texture.createView() },
    { binding: 2, resource: sampler },
  ]
  // Only planets/moons (litPipeline) declare a bumpTexture binding — the Sun's unlitPipeline has no
  // such binding, so this entry must stay entirely absent for that call, not just point at a
  // fallback: WebGPU's auto bind-group-layout requires entries to exactly match what the pipeline's
  // shader actually declares. Callers signal "this pipeline expects one" by passing
  // fallbackBumpTexture at all.
  if (fallbackBumpTexture) {
    const bumpTexture = definition.bumpMapUrl
      ? await loadBumpTexture(device, definition.bumpMapUrl)
      : fallbackBumpTexture
    entries.push({ binding: 3, resource: bumpTexture.createView() })
  }
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries,
  })
  return { definition, uniformBuffer, bindGroup }
}

// The 23.4-degree real axial tilt, expressed as a pure function of an idealized "season phase"
// (0 = June solstice, 90 = September equinox, 180 = December solstice, 270 = March equinox)
// instead of a real calendar date. In this staged diagram, Earth's position never changes - only
// its tilt orientation does - so the usual "axis is fixed in space, orbital position changes the
// angle to the Sun" mechanism is inverted: here the axis itself rotates to represent each season,
// with the Sun-Earth line fixed along local +X (see EARTH_STAGED_POSITION in main() below).
//
// Deliberately confined to the X-Y plane (Z is always exactly 0) rather than a physically literal
// rotation of a fixed-magnitude tilt vector - an earlier version let the "invisible" component of
// the lean vary along local Z (perpendicular to the learn-mode camera's screen plane), reasoning
// that depth would be invisible. It isn't: with a real perspective camera, any Z offset still
// changes which hemisphere faces the camera and makes an otherwise-vertical line read as tilted at
// varying screen depth, so the axis visibly leaned even at an equinox chapter's own "0.0deg"
// reading. Confining the pole to X-Y guarantees the drawn axis line is geometrically exactly
// parallel to the vertical reference line whenever the label reads 0.0 degrees, and the equator
// ring's plane stays edge-on to the camera (a clean ellipse, not a wandering-depth loop) at every
// phase - matching the classic flat textbook diagram this lesson is going for, not a literal orrery.
//
// X leans toward/away from the Sun (visible on screen as leaning left/right - a solstice at
// phase=0/180); Y makes up the remainder needed to keep the vector unit-length (this is why Y is no
// longer a phase-independent constant - it's exactly 1 at the equinoxes, cos(obliquity) at the
// solstices, which is the deliberate trade this model makes: real Earth's tilt magnitude never
// actually changes, but showing that here would require the very same Z-axis "invisible" lean that
// causes the misleading foreshortening above).
//
// The X-term is negated relative to a naive cos(phase) because the Sun sits at the world origin
// while Earth is staged on the +X side of it (EARTH_STAGED_POSITION below) - so the sunward
// direction as seen FROM Earth is -X, not +X. Subsolar latitude = asin(dot(northPole, sunward)),
// so a pole leaning toward +X (positive cos(phase)) actually leans AWAY from the Sun without this
// negation, inverting which hemisphere each solstice chapter's own text claims is favored. Verified
// numerically: at phase=0 ("june-solstice"), this must yield a positive subsolar latitude (north
// favored, matching real June); phase=180 ("december-solstice") must yield negative (south
// favored). See seasonalTilt.test.ts's "matches the sunward-facing hemisphere" test.
export function seasonalPoleDirection(phaseDegrees: number): [number, number, number] {
  const obliquity = (23.4 * Math.PI) / 180
  const phase = (phaseDegrees * Math.PI) / 180
  const x = -Math.sin(obliquity) * Math.cos(phase)
  const y = Math.sqrt(Math.max(0, 1 - x * x))
  return [x, y, 0]
}

// The fixed direction Earth's real rotation axis points in space, expressed in this app's own
// ecliptic-plane convention (world Z = "ecliptic north" - see poleOrientation.ts's ECLIPTIC_NORTH
// and axisAlignmentRotation's own contract, which every real body's pole already uses) - unlike
// seasonalPoleDirection's Y-up convention, built specifically for the staged chapters' different
// camera upAxis. Computed once and reused unchanged across all four orbit chapters: the entire
// visual point of this lesson's prelude is that this vector does NOT depend on phase, unlike
// seasonalPoleDirection's pole. Uses the same obliquity constant and the same "X leans, remainder
// makes up the rest" shape as seasonalPoleDirection(0)'s own lean, just re-expressed with the
// "remainder" on Z (this convention's up axis) instead of Y.
const ORBIT_OBLIQUITY_RADIANS = (23.4 * Math.PI) / 180
export const ORBIT_FIXED_POLE_DIRECTION: [number, number, number] = [
  -Math.sin(ORBIT_OBLIQUITY_RADIANS),
  0,
  Math.cos(ORBIT_OBLIQUITY_RADIANS),
]

// The rotation aligning a sphere's local +Z to ORBIT_FIXED_POLE_DIRECTION - computed once here
// (not per-frame) since the direction itself never changes during the orbit chapter. Used only for
// the orbit-chapter equator ring overlay (main()'s per-frame orbit block below), which needs a
// tilt-only world matrix (translation to Earth's current position, no spin) the same way the
// staged chapters' own equator ring uses earthLearnTilt - see that overlay block's own comments.
const ORBIT_FIXED_TILT_MATRIX = axisAlignmentRotation(ORBIT_FIXED_POLE_DIRECTION)

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

  const sphereMesh = generateSphereMesh(1, 64, 64)
  const meshBuffers = createMeshBuffers(device, sphereMesh)
  const bodySampler = createBodySampler(device)

  // Body textures are rgba8unorm-srgb (see textureLoader.ts); this pipeline/sampler pair is only
  // ever used at load time to blit each texture's mip chain, never during scene rendering itself.
  const mipmapPipeline = await createMipmapPipeline(device, 'rgba8unorm-srgb')
  const mipmapSampler = createMipmapSampler(device)

  const fallbackBumpTexture = createFallbackFlatBumpTexture(device)
  const sunRenderable = await createBodyRenderable(device, unlitPipeline, SUN, 20, bodySampler, mipmapPipeline, mipmapSampler)
  const planetRenderables = await Promise.all(
    PLANETS.map((planet) =>
      createBodyRenderable(
        device,
        litPipeline,
        planet,
        LIT_UNIFORM_FLOAT_COUNT,
        bodySampler,
        mipmapPipeline,
        mipmapSampler,
        fallbackBumpTexture,
      ),
    ),
  )
  const moonRenderables = await Promise.all(
    MOONS.map((moon) =>
      createBodyRenderable(
        device,
        litPipeline,
        moon,
        LIT_UNIFORM_FLOAT_COUNT,
        bodySampler,
        mipmapPipeline,
        mipmapSampler,
        fallbackBumpTexture,
      ),
    ),
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
  // Realistic/Compact toggle. Real ring extent is roughly 1.1-2.3 Saturn radii; not modeled per
  // body, since Saturn is the only planet with a visible ring system. Named so the ring's
  // shadow-on-Saturn test (see the planet uniform write in frame()) can derive the ring's actual
  // world-space extent from Saturn's own rendered radius instead of duplicating these numbers.
  const RING_INNER_RADIUS_FACTOR = 1.3
  const RING_OUTER_RADIUS_FACTOR = 2.3
  const ringPipeline = await createRingPipeline(device, sceneColorFormat)
  const ringMesh = generateRingMesh(RING_INNER_RADIUS_FACTOR, RING_OUTER_RADIUS_FACTOR, 128)
  const ringBuffers = createRingBuffers(device, ringMesh)
  const ringTexture = await loadBodyTexture(device, '/textures/saturn_ring.png', mipmapPipeline, mipmapSampler)
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
  // Scoped to the four gas giants specifically (per the design spec) - Earth/Venus already have
  // the additive rim-glow term in litSphereShaderCode instead. A small local constant, not a new
  // BodyDefinition field, since this is a fixed, unlikely-to-change rendering-layer decision, not
  // per-body data (mirrors RING_INNER_RADIUS_FACTOR/RING_OUTER_RADIUS_FACTOR just above).
  const GAS_GIANT_IDS = ['jupiter', 'saturn', 'uranus', 'neptune']
  const CLOUD_SHELL_RADIUS_FACTOR = 1.035
  const cloudShellPipeline = await createCloudShellPipeline(device, sceneColorFormat)
  const cloudShellRenderables = planetRenderables
    .filter((renderable) => GAS_GIANT_IDS.includes(renderable.definition.id))
    .map((renderable) => {
      const uniformBuffer = device.createBuffer({
        label: `${renderable.definition.id} cloud shell uniforms`,
        size: CLOUD_SHELL_UNIFORM_FLOAT_COUNT * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      })
      const bindGroup = device.createBindGroup({
        layout: cloudShellPipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
      })
      return { planetId: renderable.definition.id, uniformBuffer, bindGroup }
    })

  // Starts fully "Compact" (1) for a legible initial view — at "Realistic" (0), the inner
  // planets are indistinguishable from the Sun at any reasonable camera distance. The toggle
  // lets the user switch to "Realistic" to see true relative scale/distance; scaleBlendTween
  // animates scaleBlend between the two endpoints rather than snapping (see frame() below).
  let scaleBlend = 1
  const scaleBlendTween = new ScaleBlendTween(scaleBlend)
  canvas.dataset.scaleMode = 'compact'

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
    distanceBuffer: GPUBuffer
    uniformBuffer: GPUBuffer
    bindGroup: GPUBindGroup
  }

  const orbitPathRenderables: OrbitPathRenderable[] = PLANETS.map((planet) => {
    const positions = generateOrbitPathPositions(planet, scaleBlend)
    const vertexBuffer = createLineVertexBuffer(device, positions)
    const distanceBuffer = createLineVertexBuffer(device, computeCumulativeLineDistances(positions))
    const uniformBuffer = device.createBuffer({
      label: `${planet.id} orbit path uniforms`,
      size: LINE_UNIFORM_FLOAT_COUNT * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })
    const bindGroup = device.createBindGroup({
      layout: linePipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
    })
    return { definition: planet, vertexBuffer, distanceBuffer, uniformBuffer, bindGroup }
  })

  // Six overlay lines for learn mode's seasons lesson: equator, rotation axis, two symmetric
  // location markers (marker-a/marker-b, at +/-markerLatitudeDegrees), and a small "protractor" -
  // a fixed vertical reference line plus an arc sweeping from it to the actual axis line, labeling
  // the current tilt in degrees (axisTiltLabel below). All six share one uniform buffer
  // shape/bind-group-layout, so they reuse the same small helper for setup.
  const OVERLAY_LINE_IDS = ['equator', 'axis', 'marker-a', 'marker-b', 'reference', 'tilt-arc'] as const
  type OverlayLineId = (typeof OVERLAY_LINE_IDS)[number]
  interface OverlayLineRenderable {
    id: string
    vertexBuffer: GPUBuffer
    distanceBuffer: GPUBuffer
    uniformBuffer: GPUBuffer
    bindGroup: GPUBindGroup
    pointCount: number
  }
  function createOverlayLineRenderable(id: string, initialPoints: Float32Array): OverlayLineRenderable {
    const vertexBuffer = createLineVertexBuffer(device, initialPoints)
    const distanceBuffer = createLineVertexBuffer(device, computeCumulativeLineDistances(initialPoints))
    const uniformBuffer = device.createBuffer({
      label: `${id} overlay uniforms`,
      size: LINE_UNIFORM_FLOAT_COUNT * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })
    const bindGroup = device.createBindGroup({
      layout: linePipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
    })
    return { id, vertexBuffer, distanceBuffer, uniformBuffer, bindGroup, pointCount: initialPoints.length / 3 }
  }
  function updateOverlayLineRenderable(renderable: OverlayLineRenderable, points: Float32Array): void {
    updateLineVertexBuffer(device, renderable.vertexBuffer, points)
    updateLineVertexBuffer(device, renderable.distanceBuffer, computeCumulativeLineDistances(points))
    renderable.pointCount = points.length / 3
  }
  // Segment counts for the two ring-shaped overlays. These are shared between the placeholder
  // buffers created here and every frame's actual geometry computation below: createLineVertexBuffer
  // sizes each GPU buffer to its *initial* array's byte length and updateLineVertexBuffer never
  // resizes it, so the placeholder point count must exactly match what gets written every frame -
  // otherwise a later, larger write overruns the buffer and Dawn reports a GPUValidationError.
  const OVERLAY_EQUATOR_SEGMENTS = 64
  const OVERLAY_LATITUDE_MARKER_SEGMENTS = 16
  const OVERLAY_TILT_ARC_SEGMENTS = 24
  const overlayLineRenderables: Record<OverlayLineId, OverlayLineRenderable> = {
    equator: createOverlayLineRenderable('equator', new Float32Array((OVERLAY_EQUATOR_SEGMENTS + 1) * 3)),
    axis: createOverlayLineRenderable('axis', new Float32Array(6)),
    'marker-a': createOverlayLineRenderable('marker-a', new Float32Array((OVERLAY_LATITUDE_MARKER_SEGMENTS + 1) * 3)),
    'marker-b': createOverlayLineRenderable('marker-b', new Float32Array((OVERLAY_LATITUDE_MARKER_SEGMENTS + 1) * 3)),
    reference: createOverlayLineRenderable('reference', new Float32Array(6)),
    'tilt-arc': createOverlayLineRenderable('tilt-arc', new Float32Array((OVERLAY_TILT_ARC_SEGMENTS + 1) * 3)),
  }
  const OVERLAY_COLORS: Record<OverlayLineId, [number, number, number, number]> = {
    equator: [0.16, 0.88, 0.79, 0.95], // neon teal
    axis: [0.98, 0.25, 0.65, 0.95], // neon pink/magenta
    'marker-a': [0.37, 0.88, 0.63, 0.95], // kept from the original marker color, distinct from both lines
    'marker-b': [0.45, 0.68, 0.98, 0.95], // a second, distinct marker color so A and B are visually distinguishable
    reference: [0.75, 0.75, 0.8, 0.4], // faint neutral grey - a "construction line," not a teaching focus
    'tilt-arc': [0.99, 0.78, 0.25, 0.95], // warm amber, distinct from every other overlay color
  }
  const OVERLAY_PULSE_SPEED_RADIANS_PER_SECOND = 3

  // Hemisphere-tint overlay (litSphereShaderCode's northHemisphereTint/southHemisphereTint): a
  // translucent wash covering the whole northern or southern half of learn-mode Earth, distinct
  // from the day/night terminator - shows which hemisphere is tilted toward the Sun THIS chapter,
  // not which side happens to be lit at this instant. Base alpha keeps both hemispheres faintly
  // visible even at the equinoxes/orbit quarter-phases (favor = 0); the range scales up to full
  // strength on the favored hemisphere at the solstices (favor = +/-1).
  const HEMISPHERE_BASE_ALPHA = 0.08
  const HEMISPHERE_ALPHA_RANGE = 0.24
  const NORTH_HEMISPHERE_TINT_COLOR: [number, number, number] = [1.0, 0.55, 0.15] // warm amber - more direct sun
  const SOUTH_HEMISPHERE_TINT_COLOR: [number, number, number] = [0.25, 0.55, 1.0] // cool blue - less direct sun

  // Four overlay lines for the orbit chapters (design spec's §4): the compact circular orbit path
  // Earth's position moves along, the fixed axis line, the current Sun-Earth reference line, and
  // the arc between them. A separate set from OVERLAY_LINE_IDS above (the staged chapters' own
  // equator/axis/markers/protractor) - the two chapter kinds never render simultaneously and use
  // genuinely different geometry (world-space-direct here, vs earthWorld-matrix-transformed there).
  const ORBIT_OVERLAY_LINE_IDS = ['orbit-path', 'orbit-axis', 'orbit-equator', 'orbit-reference', 'orbit-arc'] as const
  type OrbitOverlayLineId = (typeof ORBIT_OVERLAY_LINE_IDS)[number]
  const ORBIT_PATH_SEGMENTS = 64
  const orbitOverlayLineRenderables: Record<OrbitOverlayLineId, OverlayLineRenderable> = {
    'orbit-path': createOverlayLineRenderable('orbit-path', new Float32Array((ORBIT_PATH_SEGMENTS + 1) * 3)),
    'orbit-axis': createOverlayLineRenderable('orbit-axis', new Float32Array(6)),
    'orbit-equator': createOverlayLineRenderable('orbit-equator', new Float32Array((OVERLAY_EQUATOR_SEGMENTS + 1) * 3)),
    'orbit-reference': createOverlayLineRenderable('orbit-reference', new Float32Array(6)),
    'orbit-arc': createOverlayLineRenderable('orbit-arc', new Float32Array((OVERLAY_TILT_ARC_SEGMENTS + 1) * 3)),
  }
  const ORBIT_OVERLAY_COLORS: Record<OrbitOverlayLineId, [number, number, number, number]> = {
    'orbit-path': [0.5, 0.5, 0.55, 0.5], // faint neutral grey - a construction guide, not a teaching focus
    'orbit-axis': [0.98, 0.25, 0.65, 0.95], // same neon pink/magenta as the staged axis line - same concept, same color
    'orbit-equator': [0.16, 0.88, 0.79, 0.95], // same neon teal as the staged equator line - same concept, same color
    'orbit-reference': [0.3, 0.7, 1.0, 0.95], // bright sky blue - the moving Sun-Earth line, the other half of this chapter's teaching point
    'orbit-arc': [0.99, 0.78, 0.25, 0.95], // same warm amber as the staged tilt-arc
  }

  let showOrbitPaths = true

  function refreshOrbitPaths(): void {
    for (const path of orbitPathRenderables) {
      const positions = generateOrbitPathPositions(path.definition, scaleBlend)
      updateLineVertexBuffer(device, path.vertexBuffer, positions)
      updateLineVertexBuffer(device, path.distanceBuffer, computeCumulativeLineDistances(positions))
    }
  }

  // Keeps the camera's zoom-in floor proportional to the current scale, so a body's own close-up
  // framing (see defaultFramingRadius in cameraFollow.ts) is never overridden by an
  // Compact-appropriate minimum distance that's now orders of magnitude too large.
  function refreshCameraZoomLimits(): void {
    orbitCamera.minRadius = minOrbitRadiusForBlend(scaleBlend)
  }
  refreshCameraZoomLimits()

  // The near clip plane is derived from orbitCamera.minRadius (see nearPlaneDistance), which
  // refreshCameraZoomLimits updates - projection is rebuilt to match wherever this pair is called
  // (both here and, every tween frame, in frame() below).
  function refreshScaleDependentState(): void {
    refreshOrbitPaths()
    refreshCameraZoomLimits()
    projection = mat4.perspective(mat4.create(), Math.PI / 4, canvas.width / canvas.height, nearPlaneDistance(), 1000)
  }

  const scaleToggle = requireElement<HTMLInputElement>('#scale-toggle')
  scaleToggle.addEventListener('change', () => {
    scaleBlendTween.retarget(scaleToggle.checked ? 1 : 0, scaleBlend)
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

  // Learn-mode-only labels for the two fixed location markers (see the learn-mode overlay block in
  // frame() below). Unlike the body/moon labels above, these two DOM elements already exist in
  // index.html (not created here) - but `.body-label` itself is a bare marker class with no CSS
  // rules at all (confirmed: no `.body-label` selector anywhere in index.html's stylesheet), so
  // without these inline styles `updateLabelPosition`'s `left`/`top` writes would silently do
  // nothing (no `position: absolute` means CSS `left`/`top` have no effect) and the labels would
  // never visibly move to their marker positions. Mirrors the exact inline-style set used for the
  // body labels created above.
  const locationALabel = requireElement<HTMLDivElement>('#location-a-label')
  const locationBLabel = requireElement<HTMLDivElement>('#location-b-label')
  const axisTiltLabel = requireElement<HTMLDivElement>('#axis-tilt-label')
  const axisLineLabel = requireElement<HTMLDivElement>('#axis-line-label')
  const equatorLineLabel = requireElement<HTMLDivElement>('#equator-line-label')
  const referenceLineLabel = requireElement<HTMLDivElement>('#reference-line-label')
  for (const label of [locationALabel, locationBLabel, axisTiltLabel, axisLineLabel, equatorLineLabel, referenceLineLabel]) {
    label.style.position = 'absolute'
    label.style.transform = 'translate(-50%, 4px)'
    label.style.color = 'white'
    label.style.font = '12px sans-serif'
    label.style.textShadow = '0 0 3px black, 0 0 3px black'
    label.style.whiteSpace = 'nowrap'
  }
  // At the equinox chapters the axis and reference lines coincide exactly (0deg tilt), so their
  // label anchors land on the same screen point - a vertical nudge keeps both readable instead of
  // overlapping into garbled text.
  axisLineLabel.style.transform = 'translate(-50%, -14px)'

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
  // Compact-scale zoom) would clip away everything the camera gets close enough to actually
  // resolve. 0.02 reproduces today's Compact-mode near plane exactly (5 * 0.02 = 0.1) while
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

  // Constructed here (ahead of learnModeController, just below) so LearnModeController.enter()/
  // exit() can be handed entitySearchUI directly and disable it as part of the mode switch,
  // rather than entity search being reachable only incidentally (via the hidden Camera dock
  // panel) while in learn mode.
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

  const dockUI = new DockUI(
    document.querySelectorAll<HTMLButtonElement>('.hud-dock-btn'),
    requireElement<HTMLElement>('#hud-sheet'),
    document.querySelectorAll<HTMLElement>('.hud-sheet-panel'),
  )
  initShuttleVisual(requireElement<HTMLInputElement>('#time-shuttle'), requireElement<HTMLElement>('#time-shuttle-fill'))

  const lessonPlayer = new LessonPlayer()
  const learnModeController = new LearnModeController(document.body, cameraInput, dockUI, entitySearchUI)
  const learnModeBtn = requireElement<HTMLButtonElement>('#learn-mode-btn')
  const lessonPicker = requireElement<HTMLElement>('#lesson-picker')
  const lessonPanel = requireElement<HTMLElement>('#lesson-panel')
  const lessonChapterTitle = requireElement<HTMLElement>('#lesson-chapter-title')
  const lessonPrevBtn = requireElement<HTMLButtonElement>('#lesson-prev-chapter')
  const lessonNextBtn = requireElement<HTMLButtonElement>('#lesson-next-chapter')
  const lessonPanelGrip = requireElement<HTMLDivElement>('#lesson-panel-grip')

  // Lets the user drag the lesson panel out of the way of the 3D scene by its grip handle. The
  // panel's default CSS position (centered horizontally, anchored from a fixed top - see
  // hud.css's own comment on .hud-lesson-panel) applies only until the first drag; from then on,
  // an explicit pixel left/top (set here as inline styles, which override the CSS) takes over and
  // persists for the rest of the page session, including across chapter navigation and re-entering
  // the lesson - deliberately not reset anywhere, so a user who drags the panel aside once doesn't
  // have to redo it on every chapter change.
  let isDraggingLessonPanel = false
  let dragPointerOffsetX = 0
  let dragPointerOffsetY = 0

  function clampLessonPanelToViewport(left: number, top: number): { left: number; top: number } {
    const rect = lessonPanel.getBoundingClientRect()
    const maxLeft = Math.max(0, window.innerWidth - rect.width)
    const maxTop = Math.max(0, window.innerHeight - rect.height)
    return { left: Math.min(Math.max(left, 0), maxLeft), top: Math.min(Math.max(top, 0), maxTop) }
  }

  lessonPanelGrip.addEventListener('pointerdown', (event) => {
    const rect = lessonPanel.getBoundingClientRect()
    // Switches from the default centered/top-anchored CSS position to an explicit pixel position
    // matching where the panel already is, so starting a drag never causes a jump.
    lessonPanel.style.left = `${rect.left}px`
    lessonPanel.style.top = `${rect.top}px`
    lessonPanel.style.transform = 'none'
    dragPointerOffsetX = event.clientX - rect.left
    dragPointerOffsetY = event.clientY - rect.top
    isDraggingLessonPanel = true
    lessonPanel.classList.add('is-dragging')
    lessonPanelGrip.setPointerCapture(event.pointerId)
  })
  lessonPanelGrip.addEventListener('pointermove', (event) => {
    if (!isDraggingLessonPanel) return
    const { left, top } = clampLessonPanelToViewport(event.clientX - dragPointerOffsetX, event.clientY - dragPointerOffsetY)
    lessonPanel.style.left = `${left}px`
    lessonPanel.style.top = `${top}px`
  })
  function endLessonPanelDrag(event: PointerEvent): void {
    if (!isDraggingLessonPanel) return
    isDraggingLessonPanel = false
    lessonPanel.classList.remove('is-dragging')
    lessonPanelGrip.releasePointerCapture(event.pointerId)
  }
  lessonPanelGrip.addEventListener('pointerup', endLessonPanelDrag)
  lessonPanelGrip.addEventListener('pointercancel', endLessonPanelDrag)
  // Re-clamps after a manual drag if the window shrinks enough to leave the panel partly or fully
  // off-screen (e.g. the browser window is resized down) - a no-op before the first drag, since
  // style.left is only ever set once dragging begins.
  window.addEventListener('resize', () => {
    if (!lessonPanel.style.left) return
    const rect = lessonPanel.getBoundingClientRect()
    const { left, top } = clampLessonPanelToViewport(rect.left, rect.top)
    lessonPanel.style.left = `${left}px`
    lessonPanel.style.top = `${top}px`
  })

  // Sun stays exactly where it already is (world origin, unmoved - see planetAuPosition/SUN's own
  // rendering, untouched by this lesson). Earth is moved here, a fixed distance away along local +X,
  // for the whole time the lesson is open - not derived from any real AU distance (this is a staged
  // diagram, not a scale model; see the design spec's §3).
  const EARTH_STAGED_POSITION: [number, number, number] = [9, 0, 0]
  const EARTH_STAGED_RADIUS = 2.2 // enlarged for legibility - a staged diagram, not a scale model
  // Longitude (see overlayGeometry.ts's latitudeSurfaceNormalAndPoint) shared by both location
  // markers. earthLearnTilt (the transform this overlay uses) deliberately excludes Earth's spin,
  // so this placement is stable for the whole lesson, not just at one instant - tuned empirically
  // so both markers sit on/near the sunward-facing side rather than one of them permanently on the
  // night side, which made a season's own "gets more sunlight" claim unreadable at a glance.
  const LEARN_MARKER_LONGITUDE_DEGREES = -60

  // Set once on entering learn mode (see the lesson-picker click handler below) and never moved
  // again - this is what structurally eliminates the old slide/jump camera artifact, rather than
  // patching its timing. Tune these visually once running: the goal is Sun and Earth both
  // comfortably in frame with a clear gap between them (see the design spec's approved mockup).
  //
  // orbitCamera.upAxis defaults to ECLIPTIC_NORTH (world Z - see poleOrientation.ts), which put the
  // camera almost directly above the scene along world Y for this azimuth/elevation - and Earth's
  // pole also points mostly along world Y (seasonalPoleDirection's dominant component is
  // cos(obliquity) on Y at every phase), so that default made every chapter look nearly pole-on:
  // the two symmetric location markers, which sit on opposite sides of the pole, projected close
  // together near the globe's screen-space limb instead of spreading across it. Overriding upAxis
  // to world Y for this lesson only (restored to ECLIPTIC_NORTH on exit, below) makes world Y the
  // screen-vertical axis instead - i.e. exactly the axis Earth's tilt leans away from - producing a
  // true side profile where seasonalPoleDirection's own X-lean reads as an honest left/right tilt of
  // the drawn axis line, at every chapter, not just the two solstices.
  // Targeting Earth's own exact center keeps the day/night terminator (a great circle in the
  // plane x = EARTH_STAGED_POSITION[0]) rendering as a clean, unskewed vertical line - but it also
  // pins Earth to dead screen-center, where its own southern hemisphere (Location B) ends up
  // hidden behind the bottom lesson panel. Targeting a few units back toward the Sun instead
  // shifts Earth to the left side of the frame, clearing Location B - at the cost of a small,
  // deliberately-accepted terminator skew (the target no longer sits exactly on Earth's own
  // perpendicular plane). The skew stays subtle at this shift distance; verify live if this is
  // ever retuned further, since a large shift here trades directly against terminator straightness.
  // Radius bumped up alongside this so the Sun (now more off-center) still comfortably fits.
  const LEARN_CAMERA_TARGET: [number, number, number] = [EARTH_STAGED_POSITION[0] - 4, 0, 0]
  const LEARN_CAMERA_RADIUS = 13
  const LEARN_CAMERA_AZIMUTH = Math.PI / 2
  // Exactly 0, not a small nonzero nudge - any elevation here tilts the camera down toward the
  // scene, reading as "looking down at the equator from above" rather than a true side-on view,
  // and (before the target was retargeted to Earth's own center, above) used to shift Earth off
  // the vertical center of frame too.
  const LEARN_CAMERA_ELEVATION = 0
  const LEARN_CAMERA_UP_AXIS: [number, number, number] = [0, 1, 0]

  function applyLearnCameraFraming(): void {
    vec3.set(orbitCamera.target, ...LEARN_CAMERA_TARGET)
    orbitCamera.radius = LEARN_CAMERA_RADIUS
    orbitCamera.azimuth = LEARN_CAMERA_AZIMUTH
    orbitCamera.elevation = LEARN_CAMERA_ELEVATION
    vec3.set(orbitCamera.upAxis, ...LEARN_CAMERA_UP_AXIS)
  }

  // A shallow, side-on shot for the orbit chapter (design spec's §3) - centered on the Sun (which
  // never moves), at a low elevation so the axis's lean and the day/night split are both plainly
  // visible (the same "look at Sun and Earth from the side" convention the staged chapters already
  // use), not a top-down establishing shot. Deliberately does NOT override upAxis (contrast with
  // applyLearnCameraFraming's own upAxis override, above) - this view wants the app's normal
  // ecliptic-north-up convention (world Z). Still explicitly sets upAxis (rather than relying on it
  // already being correct) so this framing function is self-contained regardless of what state the
  // camera was left in.
  //
  // Fully fixed - never moves, not even while Earth orbits (see orbitRevolutionDegrees below).
  // Camera motion was tried first (an azimuth that tracked Earth's own orbital angle every frame,
  // so the camera always stayed perpendicular to the current Sun-Earth line) and rejected: with
  // the camera itself moving to stay "front-on" to Earth, Earth barely appeared to move at all
  // relative to the frame - it read as "the axis turns in place," the exact confusion this whole
  // prelude exists to dispel. A still camera with Earth visibly gliding across it is what actually
  // sells "Earth is orbiting."
  //
  // Azimuth PI/2 is still deliberate, not arbitrary: ORBIT_FIXED_POLE_DIRECTION's 23.4-degree lean
  // lives entirely in the world X-Z plane (zero Y component - see its own comment), so a camera
  // whose forward direction also lies in that same X-Z plane (azimuth 0) can only ever see the
  // axis foreshortened to a near-vertical line, never leaning left/right. At azimuth PI/2 the
  // camera's forward direction lies in the world Y-Z plane instead - orthogonal to the axis's own
  // plane - so the axis's lean projects as a genuine, unforeshortened diagonal at every point in
  // Earth's orbit, not just at the two phases a fixed azimuth would otherwise have to be tuned for.
  //
  // With a fixed azimuth, Earth (which sweeps through every angle as it revolves) is at its most
  // clearly visible - off to one side of the Sun - when its own orbital angle is 90 degrees away
  // from the camera's azimuth, and briefly hidden directly behind the Sun (or nearest the camera,
  // low in frame near the lesson panel) once per lap each, when its orbital angle matches the
  // camera's azimuth plus/minus 180 or 0 degrees. That momentary disappearance is expected and
  // explained in the chapter's own text - a real consequence of viewing a 3D orbit from a single
  // fixed angle, not a bug to design around.
  //
  // The azimuth itself is offset 45 degrees from the "obvious" choice of PI/2, for a second reason
  // beyond the axis-lean one below: ORBIT_FIXED_POLE_DIRECTION's own X-Z-plane lean means the
  // "reads as upright, 0 degrees" moments always occur when Earth's orbital angle is 90/270
  // degrees (independent of camera azimuth - that's purely a property of the fixed axis and
  // Earth's phase). At azimuth exactly PI/2, those are EXACTLY the same two angles where Earth is
  // occluded (front-of-Sun/behind-Sun) - the two most pedagogically important readings (the
  // equinox-like "0 degree" moments) would always land on the two least visible screen positions.
  // Offsetting the azimuth by 45 degrees moves the occlusion angles away from 90/270 without
  // giving up the axis-lean visibility the PI/2 choice was originally about (see below) - so the
  // 0-degree moments now land at a clearly visible off-to-the-side position instead.
  const ORBIT_CAMERA_TARGET: [number, number, number] = [0, 0, 0]
  const ORBIT_CAMERA_RADIUS = 22
  // A shallow angle, not a top-down one. At this low an elevation the orbit circle projects as a
  // flattened ellipse rather than a clean circle - an acceptable, deliberate trade, since conveying
  // "the axis leans" matters more here than "the path is a circle" (the orbit-path line and the
  // chapter text already establish that Earth is orbiting; this view's job is to sell the axis, not
  // the orbit's shape).
  const ORBIT_CAMERA_ELEVATION = 0.32
  const ORBIT_CAMERA_AZIMUTH = (Math.PI * 3) / 4
  // The Sun's own rendered radius is a fixed ~3 units (SUN.compactVisualRadius), unaffected by this
  // scene - so ORBIT_PATH_RADIUS needs enough margin over that to keep Earth clearly clear of the
  // Sun's disc while passing nearby it (front/behind), not just while off to the sides.
  const ORBIT_PATH_RADIUS = 11 // the compact circle Earth's position moves along
  const ORBIT_EARTH_RADIUS = 0.8 // deliberately smaller than EARTH_STAGED_RADIUS - this is a wide establishing shot, not the close-up
  // The orbit-chapter overlay's static orbit-path circle geometry, computed once: ORBIT_PATH_RADIUS
  // and ORBIT_PATH_SEGMENTS never change and the Sun/orbit circle never moves, so recomputing this
  // every frame (as the per-frame orbit-chapter overlay block used to) was wasted work.
  const ORBIT_PATH_CIRCLE_POINTS = orbitPathCirclePoints(ORBIT_PATH_RADIUS, ORBIT_PATH_SEGMENTS)
  // Degrees per second Earth's position sweeps around ORBIT_PATH_CIRCLE_POINTS while the orbit
  // chapter is open (see orbitRevolutionDegrees below) - a full lap every 28 seconds, slow enough
  // to read the live angle label as it continuously changes, fast enough to be watchable rather
  // than static-feeling.
  const ORBIT_REVOLUTION_DEGREES_PER_SECOND = 360 / 28

  function applyOrbitCameraFraming(): void {
    vec3.set(orbitCamera.target, ...ORBIT_CAMERA_TARGET)
    orbitCamera.radius = ORBIT_CAMERA_RADIUS
    orbitCamera.azimuth = ORBIT_CAMERA_AZIMUTH
    orbitCamera.elevation = ORBIT_CAMERA_ELEVATION
    vec3.set(orbitCamera.upAxis, ...ECLIPTIC_NORTH)
  }

  // Applies whichever one-time camera preset matches `kind` - called only when the chapter kind
  // actually changes (see goToChapter below), never every navigation, so the camera stays
  // perfectly still across same-kind chapter changes and while the orbit chapter's own animation
  // plays, exactly like it always has for the staged chapters.
  function applyCameraFramingForKind(kind: 'orbit' | 'staged'): void {
    if (kind === 'orbit') applyOrbitCameraFraming()
    else applyLearnCameraFraming()
  }

  // Smoothly re-tilts Earth's axis when switching chapters (a rotation tween on Earth's own transform,
  // never the camera - the camera is fixed for the whole lesson per applyLearnCameraFraming above).
  // Mirrors ScaleBlendTween's retarget/update pattern (solarSystem/scaleBlendTween.ts).
  class SeasonPhaseTween {
    private startPhase = 0
    private endPhase = 0
    private elapsedSeconds = 0
    private readonly durationSeconds = 1

    retarget(newPhase: number, currentPhase: number): void {
      this.startPhase = currentPhase
      // Wraps the raw delta into (-180, 180] before adding it back to currentPhase, so the tween
      // always sweeps the shortest way around the circle (e.g. orbit-march (270) -> orbit-june (0)
      // sweeps 90° forward, not 270° backward) instead of interpolating the raw phase numbers
      // directly. endPhase may now fall outside [0, 360) - fine and expected, since both
      // seasonalPoleDirection and orbitPositionForPhase are built from Math.cos/Math.sin, which
      // handle any real-number input correctly regardless of range.
      const shortestDelta = ((newPhase - currentPhase + 540) % 360) - 180
      this.endPhase = currentPhase + shortestDelta
      this.elapsedSeconds = 0
    }

    get isAnimating(): boolean {
      return this.elapsedSeconds < this.durationSeconds
    }

    update(deltaSeconds: number): number {
      this.elapsedSeconds = Math.min(this.elapsedSeconds + deltaSeconds, this.durationSeconds)
      const t = this.elapsedSeconds / this.durationSeconds
      return this.startPhase + (this.endPhase - this.startPhase) * easeInOutCubic(t)
    }
  }
  const seasonPhaseTween = new SeasonPhaseTween()
  let currentSeasonPhase = SEASONS_LESSON.chapters[0].seasonPhaseDegrees

  // Accumulated spin angle (radians) while a chapter is open - continuous, elapsed-time-driven, never
  // reset between chapters, so Earth keeps turning smoothly through chapter changes too. A full
  // rotation every ~12 seconds is a starting pace; tune visually.
  const LEARN_SPIN_RADIANS_PER_SECOND = (2 * Math.PI) / 12
  let learnSpinRadians = 0

  // Earth's continuously-incrementing position (degrees) around ORBIT_PATH_CIRCLE_POINTS while the
  // orbit chapter is open (see ORBIT_REVOLUTION_DEGREES_PER_SECOND above and the per-frame update
  // in frame() below) - unlike every other chapter, this one has no fixed per-chapter phase to jump
  // to, so this is a running total, not a tween target. Never reset on chapter navigation (mirrors
  // learnSpinRadians just above), only when a lesson is freshly loaded.
  let orbitRevolutionDegrees = 0

  // A separate, much faster spin than LEARN_SPIN_RADIANS_PER_SECOND, used ONLY for Earth's sphere
  // mesh during the orbit chapter (see the per-frame update and the rotation computation below) -
  // at this small scale and viewing distance, the staged chapters' slower 12-second spin is too
  // subtle to notice, defeating its purpose here: letting a viewer visually confirm which of the
  // several drawn lines (axis/equator/reference/arc) is the TRUE rotation axis, by literally
  // watching the globe turn around it. A full rotation every 3 seconds is fast enough to notice at
  // a glance without being distracting.
  const ORBIT_SPIN_RADIANS_PER_SECOND = (2 * Math.PI) / 3
  let orbitSpinRadians = 0

  // The seasonal tilt matrix computed for learn-mode Earth each frame (see the planetFrameData
  // rendering loop below) - null whenever learn mode isn't active. Exposed at this scope so the
  // overlay-geometry block further down (equator ring/axis/latitude marker) can orient itself
  // identically to Earth's own rendered tilt, rather than recomputing a (different, real-IAU-data)
  // tilt of its own.
  let earthLearnTilt: mat4 | null = null

  const lessonChapterText = requireElement<HTMLElement>('#lesson-chapter-text')

  // Snapshots of the user's explore-mode Display-toggle state, taken right before forcing both off
  // on learn-mode entry, and restored verbatim on exit - so visiting a lesson never permanently
  // alters a user's own preferences (see the lesson-picker click handler and learnModeBtn exit
  // branch below).
  let preLearnOrbitPaths = true
  let preLearnBodyLabels = true
  let preLearnFlares = true

  function refreshChapterUI(): void {
    const chapter = lessonPlayer.currentChapter
    lessonChapterTitle.textContent = `${lessonPlayer.currentChapterIndex + 1} / ${lessonPlayer.currentLesson.chapters.length}: ${chapter.title}`
    lessonPrevBtn.disabled = !lessonPlayer.hasPreviousChapter
    lessonNextBtn.disabled = !lessonPlayer.hasNextChapter
    lessonChapterText.textContent = chapter.text
    lessonPanel.dataset.chapterId = chapter.id
    lessonPanel.dataset.chapterKind = chapter.kind
  }

  learnModeBtn.addEventListener('click', () => {
    if (learnModeController.currentMode === 'learn') {
      learnModeController.exit()
      // applyLearnCameraFraming overrode upAxis to world Y for this lesson's side-on profile view -
      // restore the real astronomical default (see orbitCamera.ts's own doc comment) so explore
      // mode's north-up camera convention isn't left pointed at the wrong "north".
      vec3.set(orbitCamera.upAxis, ...ECLIPTIC_NORTH)
      showOrbitPaths = preLearnOrbitPaths
      orbitPathsToggle.checked = preLearnOrbitPaths
      canvas.dataset.orbitPaths = String(preLearnOrbitPaths)
      showBodyLabels = preLearnBodyLabels
      bodyLabelsToggle.checked = preLearnBodyLabels
      labelsContainer.style.display = preLearnBodyLabels ? '' : 'none'
      canvas.dataset.labelsVisible = String(preLearnBodyLabels)
      showFlares = preLearnFlares
      flaresToggle.checked = preLearnFlares
      canvas.dataset.flares = String(preLearnFlares)
      lessonPanel.hidden = true
      lessonPicker.hidden = true
      return
    }
    lessonPicker.hidden = !lessonPicker.hidden
  })
  lessonPicker.querySelectorAll<HTMLButtonElement>('.hud-lesson-picker-item').forEach((item) => {
    item.addEventListener('click', () => {
      const lessonId = item.dataset.lessonId
      const lesson = lessonId ? LESSONS_BY_ID[lessonId] : undefined
      if (!lesson) return
      lessonPicker.hidden = true
      lessonPlayer.load(lesson)
      preLearnOrbitPaths = showOrbitPaths
      preLearnBodyLabels = showBodyLabels
      preLearnFlares = showFlares
      showOrbitPaths = false
      orbitPathsToggle.checked = false
      canvas.dataset.orbitPaths = 'false'
      showBodyLabels = false
      bodyLabelsToggle.checked = false
      labelsContainer.style.display = 'none'
      canvas.dataset.labelsVisible = 'false'
      showFlares = false
      flaresToggle.checked = false
      canvas.dataset.flares = 'false'
      learnModeController.enter(lesson.id)
      const firstChapter = lesson.chapters[0]
      applyCameraFramingForKind(firstChapter.kind)
      currentSeasonPhase = firstChapter.seasonPhaseDegrees
      seasonPhaseTween.retarget(firstChapter.seasonPhaseDegrees, firstChapter.seasonPhaseDegrees)
      learnSpinRadians = 0
      orbitRevolutionDegrees = 0
      orbitSpinRadians = 0
      lessonPanel.hidden = false
      refreshChapterUI()
    })
  })

  // Shared by both Prev/Next: navigates, then either hard-snaps (no tween) if the chapter kind
  // changed - since a "position phase" and a "tilt phase" are different physical quantities, an
  // interpolation between them would mean nothing - or smoothly tweens as before if it didn't,
  // matching this lesson's existing "camera never moves, only re-tilts smoothly" chapter-change
  // behavior for the common case.
  function goToChapter(navigate: () => void): void {
    const previousKind = lessonPlayer.currentChapter.kind
    navigate()
    const chapter = lessonPlayer.currentChapter
    if (chapter.kind !== previousKind) {
      applyCameraFramingForKind(chapter.kind)
      currentSeasonPhase = chapter.seasonPhaseDegrees
      seasonPhaseTween.retarget(chapter.seasonPhaseDegrees, chapter.seasonPhaseDegrees)
    } else {
      seasonPhaseTween.retarget(chapter.seasonPhaseDegrees, currentSeasonPhase)
    }
    refreshChapterUI()
  }
  lessonPrevBtn.addEventListener('click', () => goToChapter(() => lessonPlayer.previousChapter()))
  lessonNextBtn.addEventListener('click', () => goToChapter(() => lessonPlayer.nextChapter()))

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

    if (learnModeController.currentMode === 'learn') {
      currentSeasonPhase = seasonPhaseTween.isAnimating ? seasonPhaseTween.update(deltaSeconds) : currentSeasonPhase
      learnSpinRadians += deltaSeconds * LEARN_SPIN_RADIANS_PER_SECOND
      // Continuously sweeps Earth's position around the orbit chapter's path (see
      // ORBIT_REVOLUTION_DEGREES_PER_SECOND above) - a no-op outside the orbit chapter, where
      // Earth's position is either the staged chapters' fixed coordinate or a real body's own
      // orbital position, neither of which this variable drives.
      if (lessonPlayer.currentChapter.kind === 'orbit') {
        orbitRevolutionDegrees += deltaSeconds * ORBIT_REVOLUTION_DEGREES_PER_SECOND
        orbitSpinRadians += deltaSeconds * ORBIT_SPIN_RADIANS_PER_SECOND
      }
    }

    // Advances the Realistic<->Compact scale toggle's animated transition, if one is in flight.
    // refreshOrbitPaths/refreshCameraZoomLimits/the projection rebuild must all run every tween
    // frame (not just once at the end), since orbit paths and clip planes need to animate in sync
    // with the bodies themselves - the same three calls the old drag-slider's `input` listener used
    // to make once per user input event.
    if (scaleBlendTween.isAnimating) {
      scaleBlend = scaleBlendTween.update(deltaSeconds)
      canvas.dataset.scaleBlend = String(scaleBlend)
      refreshScaleDependentState()
      if (!scaleBlendTween.isAnimating) canvas.dataset.scaleMode = scaleBlendTween.target === 1 ? 'compact' : 'realistic'
    }

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

    const sunRadius = scaledBodyRadiusUnits(SUN.radiusKm, SUN.compactVisualRadius, scaleBlend, AU_KM)
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
    // The flare uniforms themselves aren't written until after planet/moon positions are known
    // further below (see the disc-coverage fade computation there) — this only computes the parts
    // that don't depend on body positions.
    const sunClipW = viewProjection[15]
    const sunFlareVisible = showFlares && sunClipW > 0
    const sunNdcX = sunClipW > 0 ? viewProjection[12] / sunClipW : 0
    const sunNdcY = sunClipW > 0 ? viewProjection[13] / sunClipW : 0
    const sunNdcZ = sunClipW > 0 ? viewProjection[14] / sunClipW : 0

    if (showBodyLabels) {
      // Label positions feed CSS `left`/`top` on DOM elements, so they need CSS pixels
      // (clientWidth/clientHeight), not the canvas's backing-store pixels (canvas.width/height,
      // which include devicePixelRatio scaling and would place every label off by that factor —
      // e.g. exactly 2x too far right/down on a devicePixelRatio:2 display, pushing most labels
      // outside the label container's bounds).
      const sunScreen = worldToScreen(viewProjection, 0, 0, 0, canvas.clientWidth, canvas.clientHeight)
      updateLabelPosition(labelElements.get(SUN.id)!, sunScreen)
    }

    // Body positions/shadows are computed in three phases rather than the old two-loop
    // (planets-then-moons) structure, because a planet's shadow-occluder list needs its own
    // moons' THIS-FRAME positions, while a moon's position needs its parent's - a dependency the
    // old structure couldn't satisfy (planet uniforms, including their occluder list, used to be
    // written before any moon position existed). Phase 1 computes cheap position/radius data for
    // every planet with no GPU writes; Phase 2 computes and writes moon uniforms (a moon only ever
    // needs its own parent as a shadow occluder, already available from Phase 1) while
    // accumulating each parent's occluder list; Phase 3 does the more expensive rotation/world-
    // matrix work and writes planet uniforms, now with occluders/ring-shadow data folded in.
    const planetPositionsById = new Map<string, [number, number, number]>()
    const planetRadiusById = new Map<string, number>()
    const planetFrameData = planetRenderables.map((renderable) => {
      const isLearnEarth = learnModeController.currentMode === 'learn' && renderable.definition.id === 'earth'
      const isOrbitChapter = isLearnEarth && lessonPlayer.currentChapter.kind === 'orbit'
      // Earth in learn mode bypasses the real orbital-position pipeline (planetAuPosition +
      // scaledPosition) entirely - during the 'orbit' chapter it continuously sweeps around the
      // compact orbit path (orbitPositionForPhase, driven by orbitRevolutionDegrees, not a fixed
      // per-chapter phase); during 'staged' chapters it sits at a fixed staged coordinate. Neither
      // is ever derived from a real date, per the design spec's §3.
      let sx: number, sy: number, sz: number
      if (isOrbitChapter) {
        ;[sx, sy, sz] = orbitPositionForPhase(orbitRevolutionDegrees, ORBIT_PATH_RADIUS)
      } else if (isLearnEarth) {
        ;[sx, sy, sz] = EARTH_STAGED_POSITION
      } else {
        const { x, y, z, distanceAu } = planetAuPosition(renderable.definition, T)
        ;[sx, sy, sz] = scaledPosition(x, y, z, distanceAu, scaleBlend)
      }
      planetPositionsById.set(renderable.definition.id, [sx, sy, sz])
      const radius = isOrbitChapter
        ? ORBIT_EARTH_RADIUS
        : isLearnEarth
          ? EARTH_STAGED_RADIUS
          : scaledBodyRadiusUnits(renderable.definition.radiusKm, renderable.definition.compactVisualRadius, scaleBlend, AU_KM)
      planetRadiusById.set(renderable.definition.id, radius)
      return { renderable, x: sx, y: sy, z: sz, radius }
    })

    // xyz = world-space center, w = world-space radius; the same [center, radius] shape written
    // into a lit body's `occluders` uniform slots (see shaders.ts's Uniforms layout comment).
    type Occluder = [number, number, number, number]
    const moonOccludersByParentId = new Map<string, Occluder[]>()

    if (showMoons && learnModeController.currentMode !== 'learn') {
      for (const renderable of moonRenderables) {
        const moon = renderable.definition
        const parentPosition = planetPositionsById.get(moon.parentId)
        if (!parentPosition) continue
        const angle = moonOrbitAngleRadians(daysSinceEpoch, moon.siderealOrbitPeriodDays)
        const orbitRadius = scaledMoonOrbitRadiusUnits(moon.orbitDistanceKm, moon.compactOrbitVisualRadius, scaleBlend, AU_KM)
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
        const radius = scaledBodyRadiusUnits(moon.radiusKm, moon.compactVisualRadius, scaleBlend, AU_KM)
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
        const uniforms = new Float32Array(LIT_UNIFORM_FLOAT_COUNT)
        uniforms.set(wvp, 0)
        uniforms.set(world, 16)
        uniforms.set([...moon.color, 1.0], 32)
        uniforms.set([...lightDirection, 0], 36)
        uniforms.set([...cameraPosition, 0], 40)
        // A moon only ever needs its own parent planet as a shadow occluder (the planet eclipsing
        // its moon) - slot 0 holds the parent, the remaining 3 stay zero (unused).
        uniforms.set([px, py, pz, planetRadiusById.get(moon.parentId) ?? 0], 44)
        uniforms.set([sunRadius, 0, 0, 0], 60)
        uniforms.set([moon.bumpIntensity ?? 0, 0, 0, 0], 68)
        device.queue.writeBuffer(renderable.uniformBuffer, 0, uniforms)

        const parentOccluders = moonOccludersByParentId.get(moon.parentId) ?? []
        parentOccluders.push([sx, sy, sz, radius])
        moonOccludersByParentId.set(moon.parentId, parentOccluders)

        if (showBodyLabels) {
          const screen = worldToScreen(viewProjection, sx, sy, sz, canvas.clientWidth, canvas.clientHeight)
          updateLabelPosition(labelElements.get(moon.id)!, screen)
        }
      }
    } else {
      // Otherwise a moon's label would freeze at its last position (still visible) instead of
      // disappearing the moment moons are hidden, since nothing would update it again. Hidden
      // moons also cast no shadows (moonOccludersByParentId stays empty), matching what's rendered.
      for (const moon of MOONS) {
        labelElements.get(moon.id)!.style.display = 'none'
      }
    }

    if (sunFlareVisible) {
      // How much of the Sun's own screen-space disc is covered by a nearer body (any planet or
      // moon), as a smooth [0,1] fraction rather than the flare pipeline's per-pixel depth test
      // alone (see circleOverlap.ts and flareShaderCode's doc comment for why the two are
      // complementary, not redundant). Needs planet/moon positions, hence computed here rather
      // than earlier alongside sunClipW/sunNdc.
      const cameraRight: [number, number, number] = [view[0], view[4], view[8]]
      function screenSpaceBody(x: number, y: number, z: number, worldRadius: number) {
        const center = worldToScreen(viewProjection, x, y, z, canvas.width, canvas.height)
        const edge = worldToScreen(
          viewProjection,
          x + cameraRight[0] * worldRadius,
          y + cameraRight[1] * worldRadius,
          z + cameraRight[2] * worldRadius,
          canvas.width,
          canvas.height,
        )
        return { center, screenRadius: Math.hypot(edge.x - center.x, edge.y - center.y) }
      }
      const sunDistanceToCamera = Math.hypot(...cameraPosition)
      const sunScreen = screenSpaceBody(0, 0, 0, sunRadius)
      const occludingBodies: Array<{ x: number; y: number; z: number; radius: number }> = [
        ...planetFrameData.map(({ x, y, z, radius }) => ({ x, y, z, radius })),
        ...[...moonOccludersByParentId.values()].flat().map(([x, y, z, radius]) => ({ x, y, z, radius })),
      ]
      let sunVisibleFraction = 1
      for (const body of occludingBodies) {
        const distanceToCamera = Math.hypot(body.x - cameraPosition[0], body.y - cameraPosition[1], body.z - cameraPosition[2])
        if (distanceToCamera >= sunDistanceToCamera) continue // only nearer bodies can occlude the Sun
        const bodyScreen = screenSpaceBody(body.x, body.y, body.z, body.radius)
        if (!bodyScreen.center.visible) continue
        const separation = Math.hypot(bodyScreen.center.x - sunScreen.center.x, bodyScreen.center.y - sunScreen.center.y)
        const overlap = circleOverlapFraction(sunScreen.screenRadius, bodyScreen.screenRadius, separation)
        sunVisibleFraction = Math.min(sunVisibleFraction, 1 - overlap)
      }
      sunVisibleFraction = Math.max(0, sunVisibleFraction)

      for (const flare of flareRenderables) {
        const { widthPx, heightPx, color, t, bladeCount, rotation } = flare.spec
        const mirrorFactor = 1 - 2 * t
        // Additive blending (see createFlarePipeline) means the alpha channel has zero effect on
        // the final blended color - the fade must scale RGB, not alpha, or it would be a silent
        // no-op.
        const fadedColor: [number, number, number, number] = [
          color[0] * sunVisibleFraction,
          color[1] * sunVisibleFraction,
          color[2] * sunVisibleFraction,
          color[3],
        ]
        const flareUniforms = new Float32Array(12)
        flareUniforms.set(fadedColor, 0)
        flareUniforms.set([sunNdcX * mirrorFactor, sunNdcY * mirrorFactor], 4)
        flareUniforms.set([(widthPx * 2) / canvas.width, (heightPx * 2) / canvas.height], 6)
        flareUniforms.set([sunNdcZ, bladeCount, rotation], 8)
        device.queue.writeBuffer(flare.uniformBuffer, 0, flareUniforms)
      }
    }

    for (const { renderable, x: sx, y: sy, z: sz, radius } of planetFrameData) {
      const isLearnEarth = learnModeController.currentMode === 'learn' && renderable.definition.id === 'earth'
      const isOrbitChapter = isLearnEarth && lessonPlayer.currentChapter.kind === 'orbit'
      const rotation = isOrbitChapter
        ? orbitSpinRadians
        : isLearnEarth
          ? learnSpinRadians
          : rotationAngleRadians(daysSinceEpoch, renderable.definition.siderealRotationHours)
      const poleDirection = isOrbitChapter
        ? ORBIT_FIXED_POLE_DIRECTION
        : isLearnEarth
          ? seasonalPoleDirection(currentSeasonPhase)
          : equatorialToEclipticPoleDirection(renderable.definition.poleRightAscensionDegrees, renderable.definition.poleDeclinationDegrees)
      const tilt = axisAlignmentRotation(poleDirection)
      // earthLearnTilt is only set for 'staged' chapters (null during 'orbit' chapters and
      // outside learn mode) - the staged-chapter overlay block below is gated on it being
      // non-null, so this alone correctly skips that block during orbit chapters without needing
      // to touch that block's own condition at all. earthLearnTilt deliberately excludes the spin
      // rotation (learnSpinRadians, applied below via fromZRotation only to the sphere mesh's own
      // `world` matrix) - the axis/equator overlay lines and the two location markers are
      // spin-invariant and must stay fixed in place at their tilt-defined latitude rather than
      // periodically spinning around to Earth's occluded far side.
      if (renderable.definition.id === 'earth') earthLearnTilt = isLearnEarth && !isOrbitChapter ? tilt : null
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
      const uniforms = new Float32Array(LIT_UNIFORM_FLOAT_COUNT)
      uniforms.set(wvp, 0)
      uniforms.set(world, 16)
      uniforms.set([...renderable.definition.color, 1.0], 32)
      uniforms.set([...lightDirection, 0], 36)
      uniforms.set([...cameraPosition, 0], 40)
      const occluders = moonOccludersByParentId.get(renderable.definition.id) ?? []
      for (let slot = 0; slot < 4; slot++) {
        uniforms.set(occluders[slot] ?? [0, 0, 0, 0], 44 + slot * 4)
      }
      const isSaturn = renderable.definition.id === 'saturn'
      uniforms.set(
        [sunRadius, isSaturn ? radius * RING_INNER_RADIUS_FACTOR : 0, isSaturn ? radius * RING_OUTER_RADIUS_FACTOR : 0, 0],
        60,
      )
      const { atmosphereColor, atmosphereIntensity, bumpIntensity } = renderable.definition
      if (atmosphereColor && atmosphereIntensity) {
        uniforms.set([...atmosphereColor, atmosphereIntensity], 64)
      }
      uniforms.set([bumpIntensity ?? 0, 0, 0, 0], 68)
      if (isLearnEarth) {
        // Which hemisphere is tilted toward the Sun this chapter: same subsolar-latitude formula
        // as seasonalTilt.test.ts's own check (asin(dot(northPole, sunwardFromEarth))), reusing
        // poleDirection/lightDirection already computed above for both chapter kinds - positive
        // means north favored, negative means south, 0 at the equinoxes/orbit's quarter-phases.
        const sunwardFromEarth: [number, number, number] = [-lightDirection[0], -lightDirection[1], -lightDirection[2]]
        const subsolarLatitudeRadians = Math.asin(
          Math.max(-1, Math.min(1, poleDirection[0] * sunwardFromEarth[0] + poleDirection[1] * sunwardFromEarth[1] + poleDirection[2] * sunwardFromEarth[2])),
        )
        const favor = Math.max(-1, Math.min(1, subsolarLatitudeRadians / ORBIT_OBLIQUITY_RADIANS))
        const northAlpha = HEMISPHERE_BASE_ALPHA + HEMISPHERE_ALPHA_RANGE * Math.max(0, favor)
        const southAlpha = HEMISPHERE_BASE_ALPHA + HEMISPHERE_ALPHA_RANGE * Math.max(0, -favor)
        uniforms.set([...NORTH_HEMISPHERE_TINT_COLOR, northAlpha], 72)
        uniforms.set([...SOUTH_HEMISPHERE_TINT_COLOR, southAlpha], 76)
      }
      device.queue.writeBuffer(renderable.uniformBuffer, 0, uniforms)

      const cloudShell = cloudShellRenderables.find((shell) => shell.planetId === renderable.definition.id)
      if (cloudShell && atmosphereColor && atmosphereIntensity) {
        const shellRadius = radius * CLOUD_SHELL_RADIUS_FACTOR
        const shellWorld = mat4.multiply(
          mat4.create(),
          mat4.fromTranslation(mat4.create(), [sx, sy, sz]),
          mat4.multiply(
            mat4.create(),
            tilt,
            mat4.multiply(mat4.create(), mat4.fromZRotation(mat4.create(), rotation), mat4.fromScaling(mat4.create(), [shellRadius, shellRadius, shellRadius])),
          ),
        )
        const shellWvp = mat4.multiply(mat4.create(), projection, mat4.multiply(mat4.create(), view, shellWorld))
        const shellUniforms = new Float32Array(CLOUD_SHELL_UNIFORM_FLOAT_COUNT)
        shellUniforms.set(shellWvp, 0)
        shellUniforms.set(shellWorld, 16)
        shellUniforms.set([...atmosphereColor, atmosphereIntensity], 32)
        shellUniforms.set([...lightDirection, 0], 36)
        shellUniforms.set([...cameraPosition, 0], 40)
        device.queue.writeBuffer(cloudShell.uniformBuffer, 0, shellUniforms)
      }

      if (isSaturn) {
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

    const currentChapterKind = learnModeController.currentMode === 'learn' ? lessonPlayer.currentChapter.kind : null

    if (learnModeController.currentMode === 'learn' && earthLearnTilt) {
      const earthEntry = planetFrameData.find((entry) => entry.renderable.definition.id === 'earth')
      if (earthEntry) {
        // Reuses the exact same tilt matrix Earth itself was just rendered with above (computed
        // from seasonalPoleDirection, not real IAU pole data) so this overlay never drifts out of
        // sync with the planet it's drawn on.
        const earthWorld = mat4.multiply(mat4.create(), mat4.fromTranslation(mat4.create(), [earthEntry.x, earthEntry.y, earthEntry.z]), earthLearnTilt)
        const ringRadius = earthEntry.radius * 1.02
        const markerLatitude = lessonPlayer.currentLesson.markerLatitudeDegrees
        const now = performance.now() / 1000
        const pulse = 1 + 0.15 * Math.sin(now * 3)
        const markerRadius = earthEntry.radius * 0.04 * pulse

        // Two symmetric, mirror-opposite markers (+/-markerLatitude) replace the old single
        // latitude-picker marker + sun-angle ray - see Task 5/6 for the id rename and the neon
        // pulsing-glow shader mode these now use instead of the marching-ants dash.
        //
        // The reference/tilt-arc pair is a small "protractor": a fixed world-+Y reference (the
        // axis's zero-tilt baseline) and an arc sweeping from it to the actual axis line, both
        // anchored on Earth's center (position only, not earthLearnTilt's rotation - see
        // overlayGeometry.ts's own doc comments). The swept angle is the pole direction's own
        // atan2(x, y): with the learn-mode camera's upAxis set to world Y (see
        // applyLearnCameraFraming), this is the same angle the drawn axis line visibly leans by.
        const earthCenter: [number, number, number] = [earthEntry.x, earthEntry.y, earthEntry.z]
        const currentPoleDirection = seasonalPoleDirection(currentSeasonPhase)
        const tiltAngleRadians = Math.atan2(currentPoleDirection[0], currentPoleDirection[1])
        const referenceLength = earthEntry.radius * 1.3
        const arcRadius = earthEntry.radius * 1.15

        const geometryById: Record<OverlayLineId, Float32Array> = {
          equator: equatorRingPoints(earthWorld, ringRadius, OVERLAY_EQUATOR_SEGMENTS),
          axis: rotationAxisPoints(earthWorld, earthEntry.radius, 1.3),
          'marker-a': latitudeMarkerPoints(
            earthWorld,
            ringRadius,
            markerLatitude,
            markerRadius,
            OVERLAY_LATITUDE_MARKER_SEGMENTS,
            LEARN_MARKER_LONGITUDE_DEGREES,
          ),
          'marker-b': latitudeMarkerPoints(
            earthWorld,
            ringRadius,
            -markerLatitude,
            markerRadius,
            OVERLAY_LATITUDE_MARKER_SEGMENTS,
            LEARN_MARKER_LONGITUDE_DEGREES,
          ),
          reference: verticalReferencePoints(earthCenter, referenceLength),
          'tilt-arc': tiltAngleArcPoints(earthCenter, arcRadius, tiltAngleRadians, OVERLAY_TILT_ARC_SEGMENTS),
        }
        const pulsePhaseRadians = now * OVERLAY_PULSE_SPEED_RADIANS_PER_SECOND
        // Unlike every other worldViewProjection in this file, no separate world matrix multiply
        // is needed here: overlayGeometry.ts's functions already compute their points directly in
        // world space (they take `earthWorld` themselves), so `worldViewProjection` for these
        // uniforms really is just `viewProjection`, not `projection * view * world`.
        for (const id of OVERLAY_LINE_IDS) {
          const renderable = overlayLineRenderables[id]
          updateOverlayLineRenderable(renderable, geometryById[id])
          const uniforms = new Float32Array(LINE_UNIFORM_FLOAT_COUNT)
          uniforms.set(viewProjection, 0)
          uniforms.set(OVERLAY_COLORS[id], 16)
          // dashParams: x/z unused in glow mode, y = live pulse phase, w = 2.0 (glow mode) - see
          // shaders.ts's lineShaderCode for the shader's glow-mode branch. The reference/tilt-arc
          // pair stays solid (w = 0) - a static protractor reads better without the pulse that
          // helps the teaching-focus axis/equator/marker lines stand out.
          const dashMode = id === 'reference' || id === 'tilt-arc' ? 0 : 2.0
          uniforms.set([0, pulsePhaseRadians, 0, dashMode], 20)
          device.queue.writeBuffer(renderable.uniformBuffer, 0, uniforms)
        }

        const markerACenter = latitudeMarkerCenter(earthWorld, ringRadius, markerLatitude, LEARN_MARKER_LONGITUDE_DEGREES)
        const markerBCenter = latitudeMarkerCenter(earthWorld, ringRadius, -markerLatitude, LEARN_MARKER_LONGITUDE_DEGREES)
        const markerAScreen = worldToScreen(viewProjection, ...markerACenter, canvas.clientWidth, canvas.clientHeight)
        const markerBScreen = worldToScreen(viewProjection, ...markerBCenter, canvas.clientWidth, canvas.clientHeight)
        updateLabelPosition(locationALabel, markerAScreen)
        updateLabelPosition(locationBLabel, markerBScreen)

        const tiltLabelPoint: [number, number, number] = [
          earthCenter[0] + arcRadius * Math.sin(tiltAngleRadians / 2),
          earthCenter[1] + arcRadius * Math.cos(tiltAngleRadians / 2),
          earthCenter[2],
        ]
        const tiltLabelScreen = worldToScreen(viewProjection, ...tiltLabelPoint, canvas.clientWidth, canvas.clientHeight)
        axisTiltLabel.textContent = `${Math.abs((tiltAngleRadians * 180) / Math.PI).toFixed(1)}°`
        updateLabelPosition(axisTiltLabel, tiltLabelScreen)

        // Anchor each explanatory label on its own line's own geometry: the axis line's north
        // endpoint (index 1 of geometryById.axis), a fixed point on the equator ring (index 0,
        // angle=0), and the reference line's +Y endpoint (index 1 of geometryById.reference) - see
        // rotationAxisPoints/verticalReferencePoints' own point-order comments in overlayGeometry.ts.
        const axisLine = geometryById.axis
        updateLabelPosition(
          axisLineLabel,
          worldToScreen(viewProjection, axisLine[3], axisLine[4], axisLine[5], canvas.clientWidth, canvas.clientHeight),
        )
        const equatorLine = geometryById.equator
        updateLabelPosition(
          equatorLineLabel,
          worldToScreen(viewProjection, equatorLine[0], equatorLine[1], equatorLine[2], canvas.clientWidth, canvas.clientHeight),
        )
        const referenceLine = geometryById.reference
        updateLabelPosition(
          referenceLineLabel,
          worldToScreen(viewProjection, referenceLine[3], referenceLine[4], referenceLine[5], canvas.clientWidth, canvas.clientHeight),
        )
      }
    } else if (currentChapterKind === 'orbit') {
      const earthEntry = planetFrameData.find((entry) => entry.renderable.definition.id === 'earth')
      if (earthEntry) {
        const earthPosition: [number, number, number] = [earthEntry.x, earthEntry.y, earthEntry.z]
        const sunwardDirection: [number, number, number] = [-earthEntry.x, -earthEntry.y, -earthEntry.z]
        // The "zero-tilt" reference for the angle arc/label below: not the sunward direction itself
        // (a perfectly upright axis would be 90° from sunward, not 0°) but the fixed axis's own
        // component perpendicular to sunward - see perpendicularComponent's own comment in
        // overlayGeometry.ts for why this makes the drawn arc match the displayed number.
        const perpendicularToSunward = perpendicularComponent(ORBIT_FIXED_POLE_DIRECTION, sunwardDirection)
        const axisLength = earthEntry.radius * 4
        const referenceLength = earthEntry.radius * 4
        const arcRadius = earthEntry.radius * 3
        const arcAngleRadians = angleBetweenDirections(ORBIT_FIXED_POLE_DIRECTION, perpendicularToSunward)
        // Translation-only (no spin) combined with the fixed tilt, matching how the staged
        // chapters' own equator ring uses earthLearnTilt (position + tilt, spin excluded) so the
        // ring stays fixed in place on the globe rather than visibly spinning with the surface.
        const orbitEarthWorld = mat4.multiply(mat4.create(), mat4.fromTranslation(mat4.create(), earthPosition), ORBIT_FIXED_TILT_MATRIX)
        const equatorRadius = earthEntry.radius * 1.02

        const orbitGeometryById: Record<OrbitOverlayLineId, Float32Array> = {
          'orbit-path': ORBIT_PATH_CIRCLE_POINTS,
          'orbit-axis': directedLinePoints(earthPosition, ORBIT_FIXED_POLE_DIRECTION, axisLength),
          'orbit-equator': equatorRingPoints(orbitEarthWorld, equatorRadius, OVERLAY_EQUATOR_SEGMENTS),
          // Drawn along perpendicularToSunward, NOT the raw sunwardDirection - this line's whole
          // purpose is to show the "zero-tilt" baseline the arc/label actually measure the fixed
          // axis against (matching the staged chapters' own reference line, which is the vertical
          // zero-tilt baseline, not a line pointing at anything else). Drawing it along the raw
          // sunward direction instead (an earlier version) made it visually disagree with the arc,
          // which has always swept from perpendicularToSunward - the two would appear misaligned
          // rather than the arc looking like it connects the reference line to the axis line.
          'orbit-reference': directedLinePoints(earthPosition, perpendicularToSunward, referenceLength),
          'orbit-arc': greatCircleArcPoints(earthPosition, perpendicularToSunward, ORBIT_FIXED_POLE_DIRECTION, arcRadius, OVERLAY_TILT_ARC_SEGMENTS),
        }
        const pulsePhaseRadians = (performance.now() / 1000) * OVERLAY_PULSE_SPEED_RADIANS_PER_SECOND
        for (const id of ORBIT_OVERLAY_LINE_IDS) {
          const renderable = orbitOverlayLineRenderables[id]
          updateOverlayLineRenderable(renderable, orbitGeometryById[id])
          const uniforms = new Float32Array(LINE_UNIFORM_FLOAT_COUNT)
          uniforms.set(viewProjection, 0)
          uniforms.set(ORBIT_OVERLAY_COLORS[id], 16)
          // The fixed axis, equator, and the current Sun-Earth reference are this chapter's
          // teaching focus (pulsing, like the staged chapters' own axis/equator/markers); the
          // orbit path and the angle arc are construction/measurement aids (solid, like the staged
          // reference/tilt-arc).
          const dashMode = id === 'orbit-axis' || id === 'orbit-equator' || id === 'orbit-reference' ? 2.0 : 0
          uniforms.set([0, pulsePhaseRadians, 0, dashMode], 20)
          device.queue.writeBuffer(renderable.uniformBuffer, 0, uniforms)
        }

        const arcMidpoint = greatCircleArcPoints(earthPosition, perpendicularToSunward, ORBIT_FIXED_POLE_DIRECTION, arcRadius, 2)
        const tiltLabelScreen = worldToScreen(viewProjection, arcMidpoint[3], arcMidpoint[4], arcMidpoint[5], canvas.clientWidth, canvas.clientHeight)
        // arcAngleRadians is the angle between the fixed axis and its own perpendicular-to-sunward
        // component - i.e. already how far the axis deviates from perpendicular-to-the-Sun (0° at
        // equinoxes, 23.4° at solstices), matching the lesson's own "leans 23.4° toward/away from
        // the Sun" text. No further transform needed - see perpendicularToSunward's comment above.
        axisTiltLabel.textContent = `${((arcAngleRadians * 180) / Math.PI).toFixed(1)}°`
        updateLabelPosition(axisTiltLabel, tiltLabelScreen)

        const orbitAxisLine = orbitGeometryById['orbit-axis']
        updateLabelPosition(
          axisLineLabel,
          worldToScreen(viewProjection, orbitAxisLine[3], orbitAxisLine[4], orbitAxisLine[5], canvas.clientWidth, canvas.clientHeight),
        )
        const orbitEquatorLine = orbitGeometryById['orbit-equator']
        updateLabelPosition(
          equatorLineLabel,
          worldToScreen(viewProjection, orbitEquatorLine[0], orbitEquatorLine[1], orbitEquatorLine[2], canvas.clientWidth, canvas.clientHeight),
        )
        const orbitReferenceLine = orbitGeometryById['orbit-reference']
        updateLabelPosition(
          referenceLineLabel,
          worldToScreen(viewProjection, orbitReferenceLine[3], orbitReferenceLine[4], orbitReferenceLine[5], canvas.clientWidth, canvas.clientHeight),
        )
      }
      locationALabel.style.display = 'none'
      locationBLabel.style.display = 'none'
    } else {
      locationALabel.style.display = 'none'
      locationBLabel.style.display = 'none'
      axisTiltLabel.style.display = 'none'
      axisLineLabel.style.display = 'none'
      equatorLineLabel.style.display = 'none'
      referenceLineLabel.style.display = 'none'
    }

    if (showOrbitPaths) {
      for (const path of orbitPathRenderables) {
        const uniforms = new Float32Array(LINE_UNIFORM_FLOAT_COUNT)
        uniforms.set(viewProjection, 0)
        uniforms.set([...path.definition.color, 0.5], 16)
        uniforms.set([0, 0, 0, 0], 20)
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
      if (learnModeController.currentMode === 'learn' && renderable.definition.id !== 'earth') continue
      drawBody(pass, litPipeline, meshBuffers, renderable.bindGroup)
    }
    if (showMoons && learnModeController.currentMode !== 'learn') {
      for (const renderable of moonRenderables) {
        drawBody(pass, litPipeline, meshBuffers, renderable.bindGroup)
      }
    }
    // Saturn's ring and every gas giant's cloud shell belong to planets other than Earth, so they
    // must stay hidden during learn mode exactly like those planets' own spheres already do (see
    // the `continue` a few lines up, in the main body-draw loop) - previously this draw call had
    // no such gate, so the ring/cloud shells kept rendering at their real orbital positions even
    // during learn mode. This went unnoticed while the staged/orbit cameras were tightly framed on
    // just Sun+Earth, but became visible once the orbit chapters' camera was widened to show more
    // of the scene, revealing Saturn (and other gas giants) still drifting through the background.
    if (learnModeController.currentMode !== 'learn') {
      // Drawn after every opaque sphere (including Saturn's own and any moon) so its depth test
      // correctly hides the portion of the ring that passes behind them.
      pass.setPipeline(ringPipeline)
      pass.setVertexBuffer(0, ringBuffers.positionBuffer)
      pass.setVertexBuffer(1, ringBuffers.uvBuffer)
      pass.setIndexBuffer(ringBuffers.indexBuffer, 'uint32')
      pass.setBindGroup(0, ringBindGroup)
      pass.drawIndexed(ringBuffers.indexCount)
      // Drawn after every opaque sphere and the ring, same reasoning: alpha-blended and depth-tested
      // but not depth-writing, so draw order relative to other transparent passes (orbit paths,
      // flares) doesn't matter for correctness, only that it's after all opaque geometry.
      pass.setPipeline(cloudShellPipeline)
      for (const shell of cloudShellRenderables) {
        pass.setVertexBuffer(0, meshBuffers.positionBuffer)
        pass.setVertexBuffer(1, meshBuffers.normalBuffer)
        pass.setVertexBuffer(2, meshBuffers.uvBuffer)
        pass.setIndexBuffer(meshBuffers.indexBuffer, 'uint32')
        pass.setBindGroup(0, shell.bindGroup)
        pass.drawIndexed(meshBuffers.indexCount)
      }
    }
    if (showOrbitPaths) {
      pass.setPipeline(linePipeline)
      for (const path of orbitPathRenderables) {
        pass.setVertexBuffer(0, path.vertexBuffer)
        pass.setVertexBuffer(1, path.distanceBuffer)
        pass.setBindGroup(0, path.bindGroup)
        pass.draw(129) // ORBIT_PATH_SEGMENTS + 1 points, see orbitPath.ts
      }
    }
    if (learnModeController.currentMode === 'learn') {
      pass.setPipeline(linePipeline)
      if (currentChapterKind === 'orbit') {
        for (const id of ORBIT_OVERLAY_LINE_IDS) {
          const renderable = orbitOverlayLineRenderables[id]
          pass.setVertexBuffer(0, renderable.vertexBuffer)
          pass.setVertexBuffer(1, renderable.distanceBuffer)
          pass.setBindGroup(0, renderable.bindGroup)
          pass.draw(renderable.pointCount)
        }
      } else {
        for (const id of OVERLAY_LINE_IDS) {
          const renderable = overlayLineRenderables[id]
          pass.setVertexBuffer(0, renderable.vertexBuffer)
          pass.setVertexBuffer(1, renderable.distanceBuffer)
          pass.setBindGroup(0, renderable.bindGroup)
          pass.draw(renderable.pointCount)
        }
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

// Guarded so importing this module for its pure exports (e.g. seasonalPoleDirection, from
// seasonalTilt.test.ts) doesn't also kick off the real app bootstrap in a non-browser environment -
// main() reaches for `document`/WebGPU immediately, which don't exist under Vitest's default node
// environment.
if (typeof window !== 'undefined') {
  main().catch((error) => {
    const canvas = document.querySelector<HTMLCanvasElement>('#scene')
    if (canvas) canvas.replaceWith(document.createTextNode(`Failed to start renderer: ${error.message}`))
    console.error(error)
  })
}
