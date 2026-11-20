import type { AssemblyKind } from '../../../app/src/spacecraft/modelFile'
import type { MeshPrimitive } from '../spacecraft/glbMesh'
import { commandModuleProfile, CSM_HEIGHTS, CSM_RADIUS, PERSON_PLACE, RCS_QUAD, SECTOR_DEGREES, SERVICE_MODULE, SPS_ENGINE, TANKS, type TankShape } from './csmProfile'
import { latheMesh, mergePrimitives, type ProfilePoint } from './latheMesh'
import { paletteTexture, swatchUv, type Rgb } from './palette'
import { PERSON } from './saturnVProfile'
import { placedLathe, tankProfile } from './shapes'

// The assemblies the CSM is shown in: the command module, the service module's shell (cut open)
// and what is inside it, its engine, the RCS quads and the high-gain antenna; a person for scale.
export const CSM_ASSEMBLIES = ['cm', 'sm', 'smInside', 'sps', 'rcs', 'antenna', 'person'] as const
export type CsmAssembly = (typeof CSM_ASSEMBLIES)[number]

export function csmAssemblyKind(assembly: CsmAssembly): AssemblyKind {
  if (assembly === 'smInside') return 'inside'
  return assembly === 'sm' ? 'shell' : 'solid'
}

// Taken apart, the command module lifts off its service module.
export function csmExplodeOffset(assembly: CsmAssembly): [number, number, number] {
  return [0, assembly === 'cm' ? 2.5 : 0, 0]
}

export const CSM_PALETTE_TEXTURE = 'csm-palette.png'

const SWATCHES = ['cm', 'sm', 'heatShield', 'engine', 'oxidizer', 'fuel', 'helium', 'oxygen', 'hydrogen', 'fuelCell', 'rcs', 'person'] as const
type Swatch = (typeof SWATCHES)[number]

const COLORS: Record<Swatch, Rgb> = {
  cm: [214, 216, 220], // the command module's aluminized skin
  sm: [196, 198, 200], // the service module's aluminium
  heatShield: [150, 110, 70], // the ablator under the skin
  engine: [52, 50, 48],
  oxidizer: [170, 80, 50], // nitrogen tetroxide, reddish brown
  fuel: [220, 200, 110], // hydrazine/UDMH (Aerozine 50)
  helium: [150, 155, 165],
  oxygen: [120, 170, 225], // as in the Saturn V
  hydrogen: [200, 225, 240],
  fuelCell: [200, 160, 60],
  rcs: [228, 228, 228],
  person: [235, 120, 40],
}

export function csmPalette(): Promise<Buffer> {
  return paletteTexture(SWATCHES.map((name) => COLORS[name]))
}

const colored = (name: Swatch, segments: number) => ({ texture: CSM_PALETTE_TEXTURE, uv: () => swatchUv(SWATCHES, name), segments })

// Every assembly's triangles.
export function csmParts(): Map<CsmAssembly, MeshPrimitive[]> {
  return new Map<CsmAssembly, MeshPrimitive[]>([
    ['cm', [commandModule()]],
    ['sm', [latheMesh(SERVICE_MODULE, { ...colored('sm', 96), sharp: true })]],
    ['smInside', [mergePrimitives(TANKS.map(tank))]],
    ['sps', [latheMesh(SPS_ENGINE, colored('engine', 48))]],
    ['rcs', [mergePrimitives([0, 1, 2, 3].map(rcsQuad))]],
    ['antenna', [highGainAntenna()]],
    ['person', [placedLathe(PERSON.profile, PERSON_PLACE, 0, colored('person', 12))]],
  ])
}

// The heat shield's curve in the ablator's colour, the cone in the skin's.
function commandModule(): MeshPrimitive {
  const profile = commandModuleProfile()
  const shoulder = profile.findIndex(([radius]) => radius >= CSM_RADIUS)
  return mergePrimitives([
    latheMesh(profile.slice(0, shoulder + 1), colored('heatShield', 96)),
    latheMesh(profile.slice(shoulder), colored('cm', 96)),
  ])
}

// Where a part stands: its sector's start angle plus `around` of its width, `out` from the axis.
function placeOf({ sector, out, around }: TankShape): [number, number] {
  if (sector === 0) return [0, 0]
  const start = SECTOR_DEGREES.slice(0, sector - 1).reduce((sum, degrees) => sum + degrees, 0)
  const angle = ((start + around * SECTOR_DEGREES[sector - 1]) * Math.PI) / 180
  return [out * Math.cos(angle), out * Math.sin(angle)]
}

// A tank (round ends) or a fuel cell (a cylinder) in its place.
function tank(shape: TankShape): MeshPrimitive {
  const { bottom, height, radius, contents } = shape
  const round = contents !== 'fuelCell'
  const dome = round ? Math.min(radius, height / 2) : 0
  const profile: ProfilePoint[] = round
    ? tankProfile({ radius, bottom: bottom + dome, top: bottom + height - dome, lowerDome: dome, upperDome: dome })
    : [[0, bottom], [radius, bottom], [radius, bottom + height], [0, bottom + height]]
  return placedLathe(profile.map(([r, y]) => [r, y - bottom] as ProfilePoint), placeOf(shape), bottom, { ...colored(contents, 32), sharp: !round })
}

// A quad: a box on the SM's skin, 90 degrees apart (a lathe of four sides).
function rcsQuad(index: number): MeshPrimitive {
  const angle = RCS_QUAD.startAngle + (index * Math.PI) / 2
  const out = CSM_RADIUS + RCS_QUAD.depth / 2
  const half = RCS_QUAD.width / 2 / Math.SQRT2
  const box: ProfilePoint[] = [[0, -RCS_QUAD.length / 2], [half * 2, -RCS_QUAD.length / 2], [half * 2, RCS_QUAD.length / 2], [0, RCS_QUAD.length / 2]]
  return placedLathe(box, [out * Math.cos(angle), out * Math.sin(angle)], RCS_QUAD.middle, { ...colored('rcs', 4), sharp: true, startAngle: Math.PI / 4 + angle })
}

// The high-gain antenna on its boom below the aft bulkhead: four dishes round a small square one.
function highGainAntenna(): MeshPrimitive {
  const base: [number, number] = [-(CSM_RADIUS - 0.3), 0]
  const top = CSM_HEIGHTS.aftBulkhead
  const boom = placedLathe([[0.04, 0], [0.04, 1.3]], base, top - 1.3, colored('rcs', 8))
  const dish: ProfilePoint[] = [[0, 0], [0.39, 0.12], [0.39, 0.14], [0, 0.02]]
  const dishes = [[-0.4, -0.4], [-0.4, 0.4], [0.4, -0.4], [0.4, 0.4]].map(([dx, dz]) => placedLathe(dish, [base[0] - 0.6 + dx, dz], top - 1.6, colored('rcs', 24)))
  return mergePrimitives([boom, ...dishes])
}

