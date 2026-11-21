import type { MeshPrimitive } from '../spacecraft/glbMesh'
import { latheMesh, mergePrimitives, type ProfilePoint } from './latheMesh'
import { APS, ASCENT_STAGE, ASCENT_TANKS, HATCH, LM_HEIGHTS, type LmTank, OVERHEAD_HATCH, RENDEZVOUS_DISH, S_BAND_DISH } from './lmProfile'
import { box, laidAlongZ, plate, polygon, prism, type Point3, type Swatch } from './lmShapes'
import { placedLathe, strutMesh, tankProfile } from './shapes'

// The ascent stage (lmProfile.ts): the crew compartment - a cylinder lying fore and aft, its flat
// front with the hatch and the two triangular windows - the midsection behind it with the docking
// tunnel on top, the aft equipment bay, the tanks' fairings either side, the RCS quads at the
// corners and the antennas; inside, the two tanks and the ascent engine.

export interface AscentLooks {
  panel: Swatch
  dark: Swatch
  black: Swatch
  glass: Swatch
  dish: Swatch
  engine: Swatch
  fuel: Swatch
  oxidizer: Swatch
}

const { floor, cabinRadius, cabinFront, cabinDepth } = ASCENT_STAGE
const CABIN_MIDDLE = floor + 0.95 // APPROX: the floor is a chord below the cylinder's axis
const CABIN_BACK = cabinFront - cabinDepth
const MIDSECTION = { bottom: floor + ASCENT_STAGE.stepUp, back: CABIN_BACK - ASCENT_STAGE.midsectionDepth }
const MIDSECTION_TOP = MIDSECTION.bottom + ASCENT_STAGE.midsectionHeight
const TUNNEL = { at: [0, -0.6] as [number, number], top: MIDSECTION_TOP + 0.55 }

const lathed = (look: Swatch, segments: number) => ({ texture: look.texture, uv: () => look.uv, segments })

export function ascentShell(looks: AscentLooks): MeshPrimitive[] {
  return [cabin(looks), front(looks), midsection(looks), tunnel(looks), ...rcsQuads(looks), ...antennas(looks)]
}

// The crew compartment: an eight-sided cylinder, 92 in across and 42 in deep.
function cabin({ panel }: AscentLooks): MeshPrimitive {
  const outline = polygon(8, cabinRadius / Math.cos(Math.PI / 8), [0, 0], 22.5)
  return laidAlongZ(prism(outline, CABIN_BACK, cabinFront, panel), [0, CABIN_MIDDLE, 0])
}

// On the front face: the hatch (32 in square) low, the two triangular windows above it - the
// Commander's on the left (+X), the LM Pilot's on the right - and the docking window over the
// Commander, on the roof.
function front({ dark, glass, black }: AscentLooks): MeshPrimitive {
  const z = cabinFront + 0.012
  const half = HATCH.size / 2
  const hatch = plate([[-half, HATCH.bottom, z], [half, HATCH.bottom, z], [half, HATCH.bottom + HATCH.size, z], [-half, HATCH.bottom + HATCH.size, z]], dark)
  const window = (side: number) => {
    const [low, top, outer] = WINDOWS(side)
    const frame: Point3[] = [[low[0], low[1] - 0.04, z], [outer[0] + 0.05 * side, outer[1] + 0.04, z], [top[0], top[1] + 0.04, z]]
    return [plate(frame, black), plate([low, outer, top].map(([x, y]) => [x, y, z + 0.004] as Point3), glass)]
  }
  const roof = CABIN_MIDDLE + cabinRadius + 0.012
  const docking = plate([[0.35, roof, 0.35], [0.7, roof, 0.35], [0.7, roof, 0.65], [0.35, roof, 0.65]], glass)
  return mergePrimitives([hatch, ...window(1), ...window(-1), docking])
}

// The midsection (54 in deep, about 5 ft high, 56 in wide) and the aft equipment bay behind it.
function midsection({ dark, black }: AscentLooks): MeshPrimitive {
  const [w, h] = [ASCENT_STAGE.midsectionHalfWidth, ASCENT_STAGE.midsectionHeight / 2]
  const outline: [number, number][] = [[-w, -h * 0.6], [-w * 0.7, -h], [w * 0.7, -h], [w, -h * 0.6], [w, h * 0.6], [w * 0.7, h], [-w * 0.7, h], [-w, h * 0.6]]
  const body = laidAlongZ(prism(outline, MIDSECTION.back, CABIN_BACK, dark), [0, MIDSECTION.bottom + h, 0])
  const bay = box([-1.1, floor + 0.55, MIDSECTION.back - 0.5], [1.1, floor + 1.75, MIDSECTION.back], black)
  return mergePrimitives([body, bay])
}

// The tanks' fairings bulging out either side of the midsection: a part of their own, so the
// cutaway can take them away whole rather than cut a sphere open.
export function fairings({ panel }: AscentLooks): MeshPrimitive[] {
  return ASCENT_TANKS.map((tank) => sphere({ ...tank, radius: tank.radius + 0.05, bottom: tank.bottom - 0.05 }, panel, 20))
}

function sphere({ at, radius, bottom }: LmTank, look: Swatch, segments: number): MeshPrimitive {
  const profile = tankProfile({ radius, bottom: radius, top: radius, lowerDome: radius, upperDome: radius })
  return placedLathe(profile, at, bottom, lathed(look, segments))
}

// The docking tunnel over the overhead hatch, with the drogue's ring on top.
function tunnel({ panel, dark }: AscentLooks): MeshPrimitive {
  const r = OVERHEAD_HATCH.radius + 0.05
  const body: ProfilePoint[] = [[r, MIDSECTION_TOP - 0.1], [r, TUNNEL.top - 0.08], [r + 0.08, TUNNEL.top - 0.08], [r + 0.08, TUNNEL.top], [r - 0.06, TUNNEL.top]]
  return mergePrimitives([latheMesh(body, { ...lathed(panel, 32), axis: TUNNEL.at, sharp: true }), placedLathe([[r - 0.06, 0], [0.12, -0.25], [0, -0.3]], TUNNEL.at, TUNNEL.top, lathed(dark, 24))])
}

// Four RCS quads at the stage's corners, each a block with four nozzles.
function rcsQuads({ black, engine }: AscentLooks): MeshPrimitive[] {
  return [45, 135, 225, 315].map((degrees) => {
    const angle = (degrees * Math.PI) / 180
    const [x, z, y] = [Math.sin(angle) * 1.82, Math.cos(angle) * 1.82 - 0.35, floor + 1.55]
    const block = box([x - 0.14, y - 0.14, z - 0.14], [x + 0.14, y + 0.14, z + 0.14], black)
    const nozzle = (dx: number, dy: number, dz: number) => strutMesh([x + dx * 0.14, y + dy * 0.14, z + dz * 0.14], [x + dx * 0.32, y + dy * 0.32, z + dz * 0.32], { radius: 0.045, ...engine, sides: 8 })
    const out = [Math.sin(angle), Math.cos(angle)]
    return mergePrimitives([block, nozzle(0, 1, 0), nozzle(0, -1, 0), nozzle(out[1], 0, -out[0]), nozzle(-out[1], 0, out[0])])
  })
}

// The rendezvous radar on the roof in front, the steerable S-band dish on its boom to the right,
// and the two VHF antennas behind - the taller one is the LM's highest point (22 ft 11 in).
function antennas({ dish, dark, panel }: AscentLooks): MeshPrimitive[] {
  const roof = CABIN_MIDDLE + cabinRadius
  const radar = mergePrimitives([box([-0.18, roof, 0.3], [0.18, roof + 0.25, 0.66], dark), placedLathe(dishProfile(RENDEZVOUS_DISH.radius), [0, 0.48], roof + 0.25, lathed(dish, 28))])
  const boomEnd: Point3 = [-1.35, MIDSECTION_TOP + 0.55, -1.25]
  const sBand = mergePrimitives([strutMesh([-0.75, MIDSECTION_TOP - 0.2, -1.05], boomEnd, { radius: 0.03, ...panel, sides: 6 }), placedLathe(dishProfile(S_BAND_DISH.radius), [boomEnd[0], boomEnd[2]], boomEnd[1], lathed(dish, 28))])
  const vhf = [
    strutMesh([0.55, MIDSECTION_TOP - 0.05, -1.35], [0.75, LM_HEIGHTS.overall, -1.55], { radius: 0.012, ...panel, sides: 5 }),
    strutMesh([-0.55, MIDSECTION_TOP - 0.05, -1.35], [-0.95, MIDSECTION_TOP + 0.95, -1.6], { radius: 0.012, ...panel, sides: 5 }),
  ]
  return [radar, sBand, ...vhf]
}

// A shallow dish facing up, from its rim down to its middle and back out underneath.
function dishProfile(radius: number): ProfilePoint[] {
  return [[0, 0.02], [radius, 0.14], [radius, 0.16], [0, 0.04]]
}

// What the cutaway shows inside: the two spherical tanks and the ascent engine.
export function ascentInside(looks: AscentLooks): MeshPrimitive[] {
  const tanks = ASCENT_TANKS.map((tank) => sphere(tank, tank.contents === 'fuel' ? looks.fuel : looks.oxidizer, 24))
  return [...tanks, placedLathe(APS.profile, TUNNEL.at, APS.exitHeight, lathed(looks.engine, 32))]
}

// A triangular window (+1 the Commander's, -1 the LM Pilot's) on the front face, at the standing
// crew's eye height: its inner edge upright, its top edge level, the third side running down and in.
// Corners (x, y): inner low, inner top, outer top.
export function WINDOWS(side: number): [number, number][] {
  const [inner, outer, low, high] = [0.12 * side, 0.7 * side, floor + 1.48, floor + 1.88]
  return [[inner, low], [inner, high], [outer, high]]
}

// Where things are, for the cockpit (lmCockpit.ts) and the camera.
export const ASCENT_FRAME = { cabinMiddle: CABIN_MIDDLE, cabinBack: CABIN_BACK, midsectionBottom: MIDSECTION.bottom, midsectionBack: MIDSECTION.back }
