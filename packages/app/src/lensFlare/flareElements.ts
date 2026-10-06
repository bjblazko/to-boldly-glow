import type { Rgb } from '../math/tuples'

// What a camera lens adds to a bright light in frame. Each element sits on the line from the Sun
// through the screen center: t = 0 on the Sun, 0.5 at the center, 1 mirrored to the other side,
// beyond 1 or below 0 further out. Sizes are radii in viewport heights, so the flare looks the same
// at any resolution. Intensities are HDR: the streak's core is bright enough for bloom to catch.
export type FlareShape = 'glow' | 'starburst' | 'streak' | 'ghost' | 'ring' | 'dirt'

export interface FlareElement {
  shape: FlareShape
  t: number
  size: number
  color: Rgb
  intensity: number
  // Sides of the aperture polygon (ghosts), or spikes of the starburst.
  blades?: number
  rotation?: number
  // Chromatic dispersion: how much bigger red is than green, and green than blue.
  dispersion?: number
  // Edge softness for ghosts, line width for rings (fractions of the radius).
  softness?: number
  // How many times longer than tall the streak is (in viewport widths per viewport height).
  stretch?: number
}

// Aperture of a typical cinema prime: six blades, slightly rotated.
const APERTURE_BLADES = 6
const APERTURE_ROTATION = 0.26

export const FLARE_ELEMENTS: FlareElement[] = [
  // Around the Sun: a warm glow, the aperture's diffraction starburst, and the long, blue
  // horizontal streak of an anamorphic lens.
  { shape: 'glow', t: 0, size: 0.26, color: [1.0, 0.86, 0.62], intensity: 0.5 },
  { shape: 'starburst', t: 0, size: 0.42, color: [1.0, 0.92, 0.8], intensity: 0.45, blades: APERTURE_BLADES, rotation: APERTURE_ROTATION },
  { shape: 'streak', t: 0, size: 0.016, color: [0.42, 0.62, 1.0], intensity: 1.8, stretch: 75 },
  // A large, faint rainbow halo around the Sun.
  { shape: 'ring', t: 0, size: 0.62, color: [0.75, 0.82, 1.0], intensity: 0.02, dispersion: 0.04, softness: 0.06 },
  // Ghosts: internal reflections, shaped by the aperture and tinted by the lens coatings.
  { shape: 'ghost', t: -0.3, size: 0.028, color: [0.45, 1.0, 0.75], intensity: 0.16, blades: APERTURE_BLADES, rotation: APERTURE_ROTATION, softness: 0.25 },
  { shape: 'ghost', t: 0.28, size: 0.045, color: [0.35, 0.9, 0.75], intensity: 0.12, blades: APERTURE_BLADES, rotation: APERTURE_ROTATION, softness: 0.2, dispersion: 0.04 },
  { shape: 'ghost', t: 0.58, size: 0.085, color: [0.75, 0.45, 1.0], intensity: 0.06, blades: APERTURE_BLADES, rotation: APERTURE_ROTATION, softness: 0.5, dispersion: 0.05 },
  { shape: 'ring', t: 0.78, size: 0.15, color: [0.6, 0.85, 1.0], intensity: 0.05, dispersion: 0.06, softness: 0.1 },
  { shape: 'ghost', t: 0.92, size: 0.032, color: [1.0, 0.7, 0.3], intensity: 0.2, blades: APERTURE_BLADES, rotation: APERTURE_ROTATION, softness: 0.15 },
  { shape: 'ghost', t: 1.15, size: 0.065, color: [0.4, 0.6, 1.0], intensity: 0.1, blades: APERTURE_BLADES, rotation: APERTURE_ROTATION, softness: 0.3, dispersion: 0.06 },
  { shape: 'ghost', t: 1.42, size: 0.2, color: [0.95, 0.6, 0.4], intensity: 0.045, blades: APERTURE_BLADES, rotation: APERTURE_ROTATION, softness: 0.6 },
  // Dust and smudges on the front element, lit up within this radius of the Sun.
  { shape: 'dirt', t: 0, size: 0.75, color: [1.0, 0.92, 0.82], intensity: 0.12 },
]
