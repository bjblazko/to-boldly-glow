import type { MeshPrimitive } from '../spacecraft/glbMesh'
import { mergePrimitives } from './latheMesh'
import { ASCENT_FRAME, WINDOWS } from './lmAscent'
import { ASCENT_STAGE, HATCH } from './lmProfile'
import { box, clipConvex, facingNormals, laidAlongZ, plate, polygon, walls, type Look, type Point3, type Swatch } from './lmShapes'
import { panelTexture, type PanelDrawing } from './lmPanels'
import { strutMesh } from './shapes'

// The crew compartment from inside (lmProfile.ts): its walls, floor and roof; the front with the
// two triangular windows at eye height, the main panels below them - the flight displays of
// panels 1 (Commander, left) and 2 (LM Pilot, right), panel 3 across under them, panel 4 with the
// guidance computer's display and keyboard (DSKY) in the middle, over the hatch - the side panels,
// the circuit breakers above them, the hand controllers on their armrests, the restraint cables and
// the alignment telescope between the two stations. The crew stood: the floor is clear.

const { floor, cabinFront: FRONT, cabinRadius } = ASCENT_STAGE
const { cabinMiddle, cabinBack } = ASCENT_FRAME
const STATION = ASCENT_STAGE.stationsApart / 2 // the Commander at +X, the LM Pilot at -X
const WALL = cabinRadius - 0.04 // the inner walls' flats

export const COCKPIT = {
  floor,
  eye: floor + 1.65,
  // Outside the hatch and just inside it, low (the crew crawled through it), then standing.
  hatchOutside: [0, floor + 0.45, FRONT + 1.2] as Point3,
  hatchInside: [0, floor + 0.45, FRONT - 0.42] as Point3,
  commander: [STATION, floor + 1.65, FRONT - 0.5] as Point3,
  pilot: [-STATION, floor + 1.65, FRONT - 0.5] as Point3,
}

// A panel's place: its lower and upper edge (metres above the floor), from x to x, leaning back.
interface PanelPlace {
  drawing: PanelDrawing
  x: [number, number]
  y: [number, number]
}

const FLIGHT_DISPLAYS = (side: 'CDR' | 'LMP'): PanelDrawing => ({
  file: `lm-panel-${side === 'CDR' ? 1 : 2}.jpg`,
  size: [0.64, 0.23],
  items: [
    { kind: 'title', at: [0.3, 0.02, 0.4, 0.05], text: side === 'CDR' ? 'COMMANDER' : 'LM PILOT' },
    { kind: 'ball', at: [0.02, 0.1, 0.3, 0.88], label: 'FDAI' },
    { kind: 'cross', at: [0.33, 0.1, 0.22, 0.88], label: 'X-POINTER' },
    side === 'CDR' ? { kind: 'tapes', at: [0.56, 0.1, 0.3, 0.88], labels: ['ALT', 'ALT RATE'] } : { kind: 'gauges', at: [0.56, 0.1, 0.3, 0.88], labels: ['RCS TEMP', 'RCS PRESS'] },
    side === 'CDR'
      ? { kind: 'switches', at: [0.87, 0.1, 0.12, 0.88], labels: ['ENG ARM'] }
      : { kind: 'lights', at: [0.87, 0.1, 0.12, 0.88], labels: ['ASC PRESS', 'DES REG', 'CES AC', 'PGNS', 'RCS', 'HEATER'], columns: 1 },
  ],
})

const PANELS: PanelPlace[] = [
  { drawing: FLIGHT_DISPLAYS('CDR'), x: [0.06, 0.7], y: [1.22, 1.45] },
  { drawing: FLIGHT_DISPLAYS('LMP'), x: [-0.7, -0.06], y: [1.22, 1.45] },
  {
    drawing: { file: 'lm-panel-3.jpg', size: [1.4, 0.12], items: [{ kind: 'switches', at: [0.01, 0.05, 0.98, 0.9], labels: ['RATE SCALE', 'ATT MODE', 'RDR TEST', 'SLEW RATE', 'TEMP MON', 'TEST MON', 'DEAD BAND', 'GYRO TEST', 'RNG ALT', 'SHFT TRUN', 'ORDEAL', 'LTG'] }] },
    x: [-0.7, 0.7],
    y: [1.1, 1.22],
  },
  {
    drawing: { file: 'lm-panel-4.jpg', size: [0.4, 0.22], items: [{ kind: 'timer', at: [0.04, 0.04, 0.28, 0.3], label: 'MISSION', digits: '102:45' }, { kind: 'dsky', at: [0.36, 0.02, 0.6, 0.96] }] },
    x: [-0.2, 0.2],
    y: [0.88, 1.1],
  },
]

// A panel's plate: its bottom edge 6 cm further back than its top (it leans back toward the crew).
function panelPlate({ drawing, x, y }: PanelPlace): MeshPrimitive {
  const look: Look = { texture: drawing.file, decal: true }
  const [zLow, zHigh] = [FRONT - 0.1, FRONT - 0.04]
  return plate([[x[1], floor + y[0], zLow], [x[0], floor + y[0], zLow], [x[0], floor + y[1], zHigh], [x[1], floor + y[1], zHigh]], look)
}

// Side panels on the walls (8 and 11 the Commander's, 14 and 16 the LM Pilot's), facing in.
const SIDE_PANELS: { drawing: PanelDrawing; side: 1 | -1; y: [number, number] }[] = [
  { drawing: { file: 'lm-panel-8.jpg', size: [0.6, 0.42], items: [{ kind: 'title', at: [0.2, 0.03, 0.6, 0.06], text: 'EXPLOSIVE DEVICES' }, { kind: 'switches', at: [0.02, 0.12, 0.96, 0.4], labels: ['SYS A', 'SYS B', 'DES PRPLNT', 'LDG GEAR', 'STAGE', 'ASC HE'] }, { kind: 'switches', at: [0.02, 0.56, 0.96, 0.4], labels: ['VHF A', 'VHF B', 'S-BAND', 'ICS', 'MASTER', 'VOX'] }] }, side: 1, y: [0.95, 1.37] },
  { drawing: { file: 'lm-panel-11.jpg', size: [0.6, 0.36], items: [{ kind: 'breakers', at: [0.02, 0.04, 0.96, 0.92], labels: ['PGNS', 'LGC', 'DSKY', 'IMU', 'ECS', 'FANS', 'GLYCOL', 'SUIT', 'CABIN', 'RCS A', 'RCS B', 'QUAD 1', 'QUAD 2', 'QUAD 3', 'QUAD 4', 'HTR', 'FLOOD', 'DOCK', 'TRACK', 'ANUN'], columns: 5 }] }, side: 1, y: [1.45, 1.81] },
  { drawing: { file: 'lm-panel-14.jpg', size: [0.6, 0.42], items: [{ kind: 'title', at: [0.25, 0.03, 0.5, 0.06], text: 'EPS' }, { kind: 'gauges', at: [0.02, 0.12, 0.96, 0.42], labels: ['DC VOLTS', 'DC AMPS', 'BAT TEMP'] }, { kind: 'switches', at: [0.02, 0.58, 0.96, 0.38], labels: ['BAT 1', 'BAT 2', 'BAT 3', 'BAT 4', 'BAT 5', 'BAT 6'] }] }, side: -1, y: [0.95, 1.37] },
  { drawing: { file: 'lm-panel-16.jpg', size: [0.6, 0.36], items: [{ kind: 'breakers', at: [0.02, 0.04, 0.96, 0.92], labels: ['AGS', 'ASA', 'AEA', 'RNDZ RDR', 'LDG RDR', 'S-BAND', 'VHF', 'TV', 'PCM', 'TIMERS', 'INST', 'CWEA', 'DC BUS', 'AC BUS', 'INV 1', 'INV 2', 'BAT FEED', 'ASC ECA', 'DES ECA', 'XLUNAR'], columns: 5 }] }, side: -1, y: [1.45, 1.81] },
]

function sidePlate({ drawing, side, y }: (typeof SIDE_PANELS)[number]): MeshPrimitive {
  const x = side * (WALL - 0.01)
  const [front, back] = [FRONT - 0.2, FRONT - 0.2 - drawing.size[0]]
  // Seen from inside, facing the wall: on the Commander's side (+X) its left edge is the end further
  // back, on the LM Pilot's the end further forward.
  const [left, right] = side > 0 ? [back, front] : [front, back]
  return plate([[x, floor + y[0], left], [x, floor + y[0], right], [x, floor + y[1], right], [x, floor + y[1], left]], { texture: drawing.file, decal: true })
}

export interface CockpitLooks {
  wall: Swatch
  floor: Swatch
  dark: Swatch
  glass: Swatch
  steel: Swatch
}

// The cockpit's parts by what the lesson labels: the panels, the DSKY's panel, the windows, and the
// rest (walls, floor, hatch, controls).
export type CockpitPart = 'cockpit' | 'panels' | 'dsky' | 'windows'

export function cockpitParts(looks: CockpitLooks): Map<CockpitPart, MeshPrimitive[]> {
  const [dsky, ...main] = [PANELS[3], ...PANELS.slice(0, 3)]
  const parts = new Map<CockpitPart, MeshPrimitive[]>([
    ['cockpit', [shell(looks), ...stations(looks), telescope(looks)]],
    ['panels', [...main.map(panelPlate), ...SIDE_PANELS.map(sidePlate)]],
    ['dsky', [panelPlate(dsky)]],
    ['windows', [1, -1].map((side) => plate(WINDOWS(side).map(([x, y]) => [x, y, FRONT - 0.037] as Point3), looks.glass))],
  ])
  return new Map([...parts].map(([part, primitives]) => [part, primitives.map(facingNormals)]))
}

// The compartment's inner walls, floor and roof, the front wall round the open hatch (it swung in,
// out of the way), the way back into the midsection.
function shell({ wall, floor: deck, dark }: CockpitLooks): MeshPrimitive {
  const outline = polygon(8, WALL / Math.cos(Math.PI / 8), [0, 0], 22.5)
  const inner = laidAlongZ(walls(outline, cabinBack + 0.03, FRONT - 0.03, wall), [0, cabinMiddle, 0])
  const endWall = (points: [number, number][], z: number) => plate(points.map(([x, y]) => [x, cabinMiddle + y, z] as Point3), wall)
  const back = endWall(outline, cabinBack + 0.03)
  const fronts = frontWall(outline).map((piece) => endWall(piece, FRONT - 0.03))
  const deckPlate = box([-0.95, floor - 0.02, cabinBack + 0.05], [0.95, floor, FRONT - 0.05], deck)
  const opening = plate([[0.6, floor + ASCENT_STAGE.stepUp, cabinBack + 0.04], [-0.6, floor + ASCENT_STAGE.stepUp, cabinBack + 0.04], [-0.6, floor + 1.95, cabinBack + 0.04], [0.6, floor + 1.95, cabinBack + 0.04]], dark)
  return mergePrimitives([inner, back, ...fronts, deckPlate, opening])
}

// At each station: the armrests, the attitude controller (right hand) and the thrust/translation
// controller (left hand), the restraint cables from the floor to the waist.
function stations({ dark, steel }: CockpitLooks): MeshPrimitive[] {
  return [STATION, -STATION].flatMap((x) => {
    const rest = (dx: number) => box([x + dx - 0.05, floor + 0.98, FRONT - 0.5], [x + dx + 0.05, floor + 1.02, FRONT - 0.18], dark)
    const grip = (dx: number) => mergePrimitives([box([x + dx - 0.03, floor + 1.02, FRONT - 0.26], [x + dx + 0.03, floor + 1.06, FRONT - 0.2], dark), strutMesh([x + dx, floor + 1.06, FRONT - 0.23], [x + dx, floor + 1.2, FRONT - 0.25], { radius: 0.018, ...dark, sides: 8 })])
    const cable = (dx: number) => strutMesh([x + dx, floor + 0.01, FRONT - 0.62], [x + dx * 0.7, floor + 0.98, FRONT - 0.48], { radius: 0.006, ...steel, sides: 5 })
    return [rest(-0.26), rest(0.26), grip(-0.26), grip(0.26), cable(-0.22), cable(0.22)]
  })
}

// The alignment optical telescope, hanging from the roof between the two stations.
function telescope({ dark }: CockpitLooks): MeshPrimitive {
  const roof = cabinMiddle + WALL
  return mergePrimitives([strutMesh([0, roof, FRONT - 0.42], [0, floor + 1.82, FRONT - 0.42], { radius: 0.07, ...dark, sides: 12 }), box([-0.06, floor + 1.74, FRONT - 0.5], [0.06, floor + 1.82, FRONT - 0.36], dark)])
}

// The front wall (its outline across, x and height from the cabin's axis) in the pieces round the
// hatch's opening: either side of it, above it and below it.
function frontWall(outline: [number, number][]): [number, number][][] {
  const half = HATCH.size / 2
  const [low, high] = [HATCH.bottom - cabinMiddle, HATCH.bottom + HATCH.size - cabinMiddle]
  const middle = clipConvex(clipConvex(outline, ([x]) => half - x), ([x]) => x + half)
  return [
    clipConvex(outline, ([x]) => x - half),
    clipConvex(outline, ([x]) => -half - x),
    clipConvex(middle, ([, y]) => y - high),
    clipConvex(middle, ([, y]) => low - y),
  ].filter((piece) => piece.length >= 3)
}

// Every panel's picture, by file name.
export async function cockpitTextures(): Promise<Map<string, Buffer>> {
  const drawings = [...PANELS.map((place) => place.drawing), ...SIDE_PANELS.map((place) => place.drawing)]
  return new Map(await Promise.all(drawings.map(async (drawing) => [drawing.file, await panelTexture(drawing)] as [string, Buffer])))
}
