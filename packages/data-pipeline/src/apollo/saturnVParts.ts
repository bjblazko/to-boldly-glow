import type { AssemblyKind } from '../../../app/src/spacecraft/modelFile'
import type { MeshPrimitive } from '../spacecraft/glbMesh'
import { latheMesh, mergePrimitives, type ProfilePoint } from './latheMesh'
import { ENGINES, FAIRING, FIN, LES, LM, PERSON, SHELLS, sivbAftProfile, TANKS, TOTAL_HEIGHT, type Tank } from './saturnVProfile'
import { swatchUv } from './palette'
import { placedLathe, plateMesh, strutMesh, tankProfile } from './shapes'

// The assemblies the Saturn V is taken apart into, top to bottom. A stage is three of them: its
// shell (cut open in the cutaway), what is inside (shown only then) and its engines.
export const SATURN_V_ASSEMBLIES = [
  'les', 'cm', 'sm', 'sla', 'lm', 'iu',
  'sivb', 'sivbInside', 'sivbEngine',
  'sii', 'siiInside', 'siiEngines',
  'sic', 'sicInside', 'sicEngines',
  'person',
] as const
export type SaturnVAssembly = (typeof SATURN_V_ASSEMBLIES)[number]


export function assemblyKind(assembly: SaturnVAssembly): AssemblyKind {
  if (assembly.endsWith('Inside')) return 'inside'
  return assembly === 'sic' || assembly === 'sii' || assembly === 'sivb' || assembly === 'sla' ? 'shell' : 'solid'
}

// How far each assembly rises in the exploded view (metres): every part clears the one below.
const RISE: Record<SaturnVAssembly, number> = {
  person: 0, sic: 0, sicInside: 0, sicEngines: 0,
  sii: 8, siiInside: 8, siiEngines: 8,
  sivb: 16, sivbInside: 16, sivbEngine: 16,
  iu: 22, sla: 27, lm: 37.5, sm: 40, cm: 42, les: 46,
}

export function explodeOffset(assembly: SaturnVAssembly): [number, number, number] {
  return [0, RISE[assembly], 0]
}

export const PAINT_TEXTURE = 'saturnV-paint.jpg'
export const PALETTE_TEXTURE = 'saturnV-palette.png'

// The palette's swatches, left to right (see saturnVTextures.ts).
export const SWATCHES = ['engine', 'lox', 'rp1', 'lh2', 'tunnel', 'gold', 'person', 'tower'] as const
type Swatch = (typeof SWATCHES)[number]

function swatch(name: Swatch): [number, number] {
  return swatchUv(SWATCHES, name)
}

const ROUND = 96
const SMALL = 32

// The paint wraps once around and runs from the nose (top of the image) to the base. The sweep
// runs from +X toward +Z, which seen from outside is right to left: the image runs the other way,
// so it reads as drawn.
const paint = { texture: PAINT_TEXTURE, uv: (_radius: number, height: number, around: number): [number, number] => [1 - around, 1 - height / TOTAL_HEIGHT] }
const colored = (name: Swatch, segments = SMALL) => ({ texture: PALETTE_TEXTURE, uv: () => swatch(name), segments })

// Every assembly's triangles, one primitive per texture it uses.
export function saturnVParts(): Map<SaturnVAssembly, MeshPrimitive[]> {
  return new Map<SaturnVAssembly, MeshPrimitive[]>([
    ['sic', [mergePrimitives([shell(SHELLS.sic), ...fins(), ...fairings()])]],
    ['sicInside', [mergePrimitives([tank(TANKS.sicLox, 'lox'), tank(TANKS.sicFuel, 'rp1'), ...loxTunnels()])]],
    ['sicEngines', [engines(ENGINES.sic)]],
    // The S-II/S-IVB interstage stayed with the S-II when the S-IVB left it.
    ['sii', [mergePrimitives([shell(SHELLS.siiInterstage), shell(SHELLS.sii), shell(SHELLS.sivbInterstage)])]],
    ['siiInside', [mergePrimitives([tank(TANKS.siiLox, 'lox'), tank(TANKS.siiLh2, 'lh2')])]],
    ['siiEngines', [engines(ENGINES.sii)]],
    ['sivb', [shell(SHELLS.sivb), latheMesh(sivbAftProfile(), colored('engine', ROUND))]],
    ['sivbInside', [mergePrimitives([tank(TANKS.sivbLox, 'lox'), tank(TANKS.sivbLh2, 'lh2')])]],
    ['sivbEngine', [engines(ENGINES.sivb)]],
    ['iu', [shell(SHELLS.iu)]],
    ['sla', [shell(SHELLS.sla)]],
    ['lm', [lunarModule()]],
    ['sm', [shell(SHELLS.sm), engines(ENGINES.sps)]],
    ['cm', [shell(SHELLS.cm)]],
    ['les', [mergePrimitives([latheMesh(LES.cover, { ...paint, segments: ROUND }), latheMesh(LES.motor, { ...paint, segments: SMALL })]), towerStruts()]],
    ['person', [placedLathe(PERSON.profile, PERSON.place, 0, colored('person', 12))]],
  ])
}

function shell(profile: ProfilePoint[]): MeshPrimitive {
  return latheMesh(profile, { ...paint, segments: ROUND, sharp: true })
}

function tank(definition: Tank, fluid: Swatch): MeshPrimitive {
  return latheMesh(tankProfile(definition), { ...colored(fluid, ROUND) })
}

function engines({ profile, exit, places }: { profile: ProfilePoint[]; exit: number; places: [number, number][] }): MeshPrimitive {
  return mergePrimitives(places.map((place) => placedLathe(profile, place, exit, colored('engine'))))
}

// The five LOX ducts down through the fuel tank to the engines.
function loxTunnels(): MeshPrimitive[] {
  const from = TANKS.sicFuel.bottom - TANKS.sicFuel.lowerDome
  const to = TANKS.sicLox.bottom - TANKS.sicLox.lowerDome
  return ENGINES.sic.places.map(([x, z]) => latheMesh([[0.22, from], [0.22, to]], { ...colored('tunnel', 12), axis: [x * 0.6, z * 0.6] }))
}

// A fin on each of the ±X and ±Z axes.
function fins(): MeshPrimitive[] {
  const { rootRadius, tipRadius, root, tip } = FIN
  return [0, 1, 2, 3].map((quarter) => {
    const [cos, sin] = [Math.round(Math.cos((quarter * Math.PI) / 2)), Math.round(Math.sin((quarter * Math.PI) / 2))]
    const at = (radius: number, height: number) => [radius * cos, height, radius * sin] as const
    return plateMesh([at(rootRadius, root[0]), at(tipRadius, tip[0]), at(tipRadius, tip[1]), at(rootRadius, root[1])], PAINT_TEXTURE, [0.5, 1 - 2 / TOTAL_HEIGHT])
  })
}

function fairings(): MeshPrimitive[] {
  return ENGINES.sic.places.slice(1).map((place) => placedLathe(FAIRING, place, 0, { ...paint, segments: SMALL }))
}

// The escape tower's four legs and the cross braces between them.
function towerStruts(): MeshPrimitive {
  const { bottom, top, bottomHalfWidth: low, topHalfWidth: high } = LES.tower
  const corners = (half: number, height: number) => [[half, height, half], [-half, height, half], [-half, height, -half], [half, height, -half]] as const
  const [lower, upper] = [corners(low, bottom), corners(high, top)]
  const middle = corners((low + high) / 2, (bottom + top) / 2)
  const [leg, brace] = [0.05, 0.03].map((radius) => ({ radius, texture: PALETTE_TEXTURE, uv: swatch('tower') }))
  const struts = lower.flatMap((corner, index) => {
    const next = (index + 1) % 4
    return [strutMesh(corner, upper[index], leg), strutMesh(corner, middle[next], brace), strutMesh(middle[index], upper[next], brace)]
  })
  return mergePrimitives(struts)
}

// A stand-in for the folded lunar module: an eight-sided descent stage, the ascent stage above.
function lunarModule(): MeshPrimitive {
  const { descent, ascent } = LM
  const box = ({ radius, bottom, top }: { radius: number; bottom: number; top: number }): ProfilePoint[] => [[0, bottom], [radius, bottom], [radius, top], [0, top]]
  return mergePrimitives([
    latheMesh(box(descent), { ...colored('gold', 8), sharp: true, startAngle: Math.PI / 8 }),
    latheMesh(box(ascent), { ...colored('engine', 6), sharp: true }),
  ])
}
