import type { Rgb } from '../math/tuples'

// How a body's surface reflects sunlight - not measured photometry, but enough to tell water from
// rock, ice from dust and cloud from gas at a glance. Where water and ice lie is read from the
// body's own albedo texture (see shading/surfaceReflectanceWgsl.ts).
export interface SurfaceMaterial {
  // Microfacet roughness of the bare surface (0 = mirror, 1 = no visible highlight at all) and how
  // strongly it shows the Sun's highlight.
  roughness: number
  specular: number
  // How much it scatters like dusty regolith: evenly bright out to the limb, as the full Moon is,
  // instead of fading toward the edge like a matte ball (0-1).
  regolith: number
  // Darkening toward the limb, as on gas giants and cloud decks (an exponent; 0 = none).
  limbDarkening: number
  // Relief read from the albedo's light and shade (craters, mountain ranges), a little exaggerated
  // so it shows from afar (0 = none). Bodies with a real height map use that instead.
  relief: number
  // Open water, recognized in the albedo by its blue: a tight, bright glint breaking into sparkles.
  ocean?: { roughness: number; specular: number; glitter: number }
  // Bright, colorless areas - polar caps, glaciers, frost - reflect as ice.
  ice?: { roughness: number; specular: number }
  // Sunlight crossing a long path through the atmosphere near the terminator, reddened (or, on
  // Mars, turned blue by its fine dust).
  twilight?: { color: Rgb; strength: number }
  // How much of the sunlight Earth's clouds (earthClouds/) hold back from the ground below them.
  cloudShadow?: number
}

const REGOLITH: SurfaceMaterial = { roughness: 0.9, specular: 0, regolith: 0.85, limbDarkening: 0, relief: 0.9 }
const ICY_REGOLITH: SurfaceMaterial = { ...REGOLITH, regolith: 0.6, ice: { roughness: 0.5, specular: 0.6 } }
const ICE_CRUST: SurfaceMaterial = { roughness: 0.45, specular: 0.8, regolith: 0.35, limbDarkening: 0, relief: 0.5 }
const GAS_GIANT: SurfaceMaterial = { roughness: 1, specular: 0, regolith: 0, limbDarkening: 0.45, relief: 0 }

export const SURFACE_MATERIALS: Readonly<Record<string, SurfaceMaterial>> = {
  mercury: REGOLITH,
  // Seen from space, Venus is its cloud deck: a soft sheen, no hard highlight, no relief.
  venus: { roughness: 0.75, specular: 0.4, regolith: 0, limbDarkening: 0.25, relief: 0, twilight: { color: [1, 0.62, 0.3], strength: 0.35 } },
  earth: {
    roughness: 0.85,
    specular: 0.4,
    regolith: 0,
    limbDarkening: 0,
    relief: 0.6,
    ocean: { roughness: 0.22, specular: 1, glitter: 1 },
    ice: { roughness: 0.45, specular: 1 },
    twilight: { color: [1, 0.6, 0.38], strength: 0.3 },
    cloudShadow: 0.6,
  },
  mars: { roughness: 0.9, specular: 0.2, regolith: 0.45, limbDarkening: 0, relief: 0.7, ice: { roughness: 0.45, specular: 0.8 }, twilight: { color: [0.45, 0.62, 1], strength: 0.2 } },
  jupiter: GAS_GIANT,
  saturn: GAS_GIANT,
  uranus: { ...GAS_GIANT, limbDarkening: 0.3 },
  neptune: { ...GAS_GIANT, limbDarkening: 0.3 },
  moon: REGOLITH,
  io: { roughness: 0.85, specular: 0.15, regolith: 0.5, limbDarkening: 0, relief: 0.35 },
  europa: ICE_CRUST,
  ganymede: ICY_REGOLITH,
  callisto: REGOLITH,
  // Titan's orange haze hides its surface: no relief, a soft limb.
  titan: { roughness: 1, specular: 0, regolith: 0, limbDarkening: 0.15, relief: 0, twilight: { color: [1, 0.55, 0.2], strength: 0.3 } },
  titania: ICE_CRUST,
  oberon: { ...ICE_CRUST, specular: 0.4, regolith: 0.5 },
  triton: ICE_CRUST,
}

export function surfaceMaterialOf(bodyId: string): SurfaceMaterial {
  const material = SURFACE_MATERIALS[bodyId]
  if (!material) throw new Error(`No surface material for ${bodyId}`)
  return material
}

export const SURFACE_UNIFORM_FLOAT_COUNT = 20

// The material as the lit body shader reads it (see the layout comment in litBodyShader.ts); cloud
// shadows only fall while the clouds are shown.
export function packSurfaceMaterial(material: SurfaceMaterial, { timeSeconds, clouds }: { timeSeconds: number; clouds: boolean }): number[] {
  const { ocean, ice, twilight } = material
  return [
    material.roughness,
    material.specular,
    material.regolith,
    material.limbDarkening,
    material.relief,
    ocean?.glitter ?? 0,
    timeSeconds,
    clouds ? (material.cloudShadow ?? 0) : 0,
    ...(ocean ? [ocean.roughness, ocean.specular, 1, 0] : [0, 0, 0, 0]),
    ...(ice ? [ice.roughness, ice.specular, 1, 0] : [0, 0, 0, 0]),
    ...(twilight ? [...twilight.color, twilight.strength] : [0, 0, 0, 0]),
  ]
}
