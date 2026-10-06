import type { Rgba } from '../math/tuples'

// One flare sprite. Sizes are in pixels. t places it on the line from the Sun through the screen
// center (0 = on the Sun, 0.5 = screen center, > 0.5 = mirrored to the other side) - where a real
// lens puts its ghosts. bladeCount picks the shape: an aperture polygon with that many sides (a
// real iris's ghosts), 0 = an anamorphic horizontal streak, -1 = a soft corona around the Sun.
export interface FlareSpec {
  widthPx: number
  heightPx: number
  color: Rgba
  t: number
  bladeCount: number
  rotation: number
}

export const FLARE_SPECS: FlareSpec[] = [
  { widthPx: 260, heightPx: 260, color: [1.0, 0.9, 0.7, 0.35], t: 0, bladeCount: -1, rotation: 0 },
  { widthPx: 800, heightPx: 4, color: [0.65, 0.8, 1.0, 0.5], t: 0, bladeCount: 0, rotation: 0 },
  { widthPx: 90, heightPx: 90, color: [1.0, 0.85, 0.55, 0.4], t: 0, bladeCount: 8, rotation: 0.3 },
  { widthPx: 34, heightPx: 34, color: [0.55, 0.75, 1.0, 0.35], t: 0.6, bladeCount: 6, rotation: 0.5 },
  { widthPx: 50, heightPx: 50, color: [1.0, 0.6, 0.35, 0.3], t: 1.15, bladeCount: 9, rotation: -0.2 },
  { widthPx: 22, heightPx: 22, color: [0.7, 1.0, 0.85, 0.28], t: 1.5, bladeCount: 5, rotation: 0.8 },
]
