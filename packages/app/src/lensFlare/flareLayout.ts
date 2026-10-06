import { clamp } from '../math/tuples'
import type { FlareElement, FlareShape } from './flareElements'

export const MAX_FLARE_ELEMENTS = 16
// color (vec4) + shape (vec4: t, size, shape code, blades) + style (vec4: rotation, dispersion, softness, stretch)
export const FLOATS_PER_ELEMENT = 12
export const SHAPE_CODES: Record<FlareShape, number> = { glow: 0, starburst: 1, streak: 2, ghost: 3, ring: 4, dirt: 5 }

// Where an element lands on screen (NDC): on the line from the Sun through the center.
export function elementCenter(sunNdc: readonly [number, number], t: number): [number, number] {
  return [sunNdc[0] * (1 - 2 * t), sunNdc[1] * (1 - 2 * t)]
}

// Light from a Sun just outside the frame still reaches the lens, so the flare fades out over a
// margin beyond the edge instead of switching off the moment the Sun leaves the picture.
const FADE_START = 1
const FADE_END = 1.35

export function frameFade(sunNdc: readonly [number, number]): number {
  const edgeDistance = Math.max(Math.abs(sunNdc[0]), Math.abs(sunNdc[1]))
  return clamp((FADE_END - edgeDistance) / (FADE_END - FADE_START), 0, 1)
}

// The element table as the flare shader reads it (FlareUniforms.elements).
export function packFlareElements(elements: FlareElement[]): Float32Array<ArrayBuffer> {
  if (elements.length > MAX_FLARE_ELEMENTS) throw new Error(`At most ${MAX_FLARE_ELEMENTS} flare elements fit the shader.`)
  const packed = new Float32Array(MAX_FLARE_ELEMENTS * FLOATS_PER_ELEMENT)
  elements.forEach((element, index) => packed.set(packElement(element), index * FLOATS_PER_ELEMENT))
  return packed
}

function packElement(element: FlareElement): number[] {
  const color = element.color.map((channel) => channel * element.intensity)
  return [
    ...color,
    0,
    element.t,
    element.size,
    SHAPE_CODES[element.shape],
    element.blades ?? 0,
    element.rotation ?? 0,
    element.dispersion ?? 0,
    element.softness ?? 0,
    element.stretch ?? 1,
  ]
}
