export interface MoonDefinition {
  id: string
  name: string
  /** id of the BodyDefinition this moon orbits. */
  parentId: string
  /** Approximate/illustrative color, used as a tint over the texture — or, for moons with no
   * texture, as the entire visible color. Not photometrically calibrated. */
  color: [number, number, number]
  /** True mean radius, kilometers. Source: NASA Planetary Satellite Fact Sheet. */
  radiusKm: number
  /** Hand-picked radius (scene units) at the fully-"explorer" end of the scale slider. */
  explorerVisualRadius: number
  /** True orbital semi-major axis around the parent, kilometers. */
  orbitDistanceKm: number
  /** Hand-picked orbit radius (scene units) at the fully-"explorer" end of the scale slider. */
  explorerOrbitVisualRadius: number
  /**
   * Sidereal orbital period, days. Negative means retrograde (Triton, uniquely among large
   * moons, orbits opposite its parent's rotation — a strong hint it's a captured object rather
   * than one formed in place). All moons here are tidally locked, so this also drives rotation:
   * the same face always points toward the parent, rather than spinning at an independent rate.
   */
  siderealOrbitPeriodDays: number
  /**
   * Real orbital inclination, degrees, relative to the parent's equatorial plane (the Laplace
   * plane, for the regular moons) - EXCEPT for the Moon, whose real orbital plane precesses
   * relative to the ECLIPTIC rather than Earth's equator (see
   * moonOrbit.ts's moonOrbitReferencePoleDirection), so this field holds its ecliptic-relative
   * inclination instead. Source: Wikipedia orbital-elements infoboxes (themselves derived from
   * JPL/IAU data); Triton's value is a representative snapshot since its node precesses with a
   * ~678-year period that isn't modeled.
   */
  orbitInclinationToParentEquatorDegrees: number
  /**
   * Longitude of the ascending node, degrees, defining which direction (within the reference
   * plane) the inclination above tilts toward. Set to 0 for every moon except Triton as a
   * documented simplification: at under half a degree of inclination, the node has no visually
   * perceptible effect for the other 8 moons. Triton's value is illustrative (see the field above).
   */
  orbitAscendingNodeDegrees: number
  /**
   * Path (under public/) to a 2K-ish equirectangular albedo texture. Omitted where no clean
   * full-sphere public-domain map exists — Titania, Oberon, and Triton were each only partially
   * imaged during Voyager 2's brief flybys, leaving large gaps in any equirectangular projection
   * of them. Those moons render as a flat `color` sphere instead of a texture full of black gaps.
   */
  textureUrl?: string
}

export const MOONS: MoonDefinition[] = [
  {
    id: 'moon',
    name: 'Moon',
    parentId: 'earth',
    color: [0.75, 0.75, 0.72],
    radiusKm: 1737.4,
    explorerVisualRadius: 0.27,
    orbitDistanceKm: 384_400,
    explorerOrbitVisualRadius: 1.7,
    siderealOrbitPeriodDays: 27.321661,
    orbitInclinationToParentEquatorDegrees: 5.145, // to the ecliptic, not Earth's equator - see field doc
    orbitAscendingNodeDegrees: 0,
    textureUrl: '/textures/moon.jpg',
  },
  {
    id: 'io',
    name: 'Io',
    parentId: 'jupiter',
    color: [0.9, 0.8, 0.5],
    radiusKm: 1821.6,
    explorerVisualRadius: 0.16,
    orbitDistanceKm: 421_800,
    explorerOrbitVisualRadius: 3.0,
    siderealOrbitPeriodDays: 1.769138,
    orbitInclinationToParentEquatorDegrees: 0.050,
    orbitAscendingNodeDegrees: 0,
    textureUrl: '/textures/io.jpg',
  },
  {
    id: 'europa',
    name: 'Europa',
    parentId: 'jupiter',
    color: [0.85, 0.8, 0.75],
    radiusKm: 1560.8,
    explorerVisualRadius: 0.14,
    orbitDistanceKm: 671_100,
    explorerOrbitVisualRadius: 3.6,
    siderealOrbitPeriodDays: 3.551181,
    orbitInclinationToParentEquatorDegrees: 0.471,
    orbitAscendingNodeDegrees: 0,
    textureUrl: '/textures/europa.jpg',
  },
  {
    id: 'ganymede',
    name: 'Ganymede',
    parentId: 'jupiter',
    color: [0.7, 0.65, 0.6],
    radiusKm: 2634.1,
    explorerVisualRadius: 0.19,
    orbitDistanceKm: 1_070_400,
    explorerOrbitVisualRadius: 4.3,
    siderealOrbitPeriodDays: 7.154553,
    orbitInclinationToParentEquatorDegrees: 0.204,
    orbitAscendingNodeDegrees: 0,
    textureUrl: '/textures/ganymede.jpg',
  },
  {
    id: 'callisto',
    name: 'Callisto',
    parentId: 'jupiter',
    color: [0.55, 0.5, 0.45],
    radiusKm: 2410.3,
    explorerVisualRadius: 0.18,
    orbitDistanceKm: 1_882_700,
    explorerOrbitVisualRadius: 5.2,
    siderealOrbitPeriodDays: 16.68902,
    orbitInclinationToParentEquatorDegrees: 0.205,
    orbitAscendingNodeDegrees: 0,
    textureUrl: '/textures/callisto.jpg',
  },
  {
    id: 'titan',
    name: 'Titan',
    parentId: 'saturn',
    color: [0.85, 0.7, 0.4],
    radiusKm: 2574.7,
    explorerVisualRadius: 0.2,
    orbitDistanceKm: 1_221_870,
    // Kept clear of Saturn's rings (outer edge at 2.3x Saturn's own explorer radius, ~4.37 units —
    // see geometry/ring.ts's generateRingMesh(1.3, 2.3, ...) call in main.ts) rather than using a
    // strictly real-ratio-scaled value, which would put Titan visually inside/through the rings.
    explorerOrbitVisualRadius: 5.5,
    siderealOrbitPeriodDays: 15.945,
    orbitInclinationToParentEquatorDegrees: 0.34854,
    orbitAscendingNodeDegrees: 0,
    textureUrl: '/textures/titan.jpg',
  },
  {
    id: 'titania',
    name: 'Titania',
    parentId: 'uranus',
    color: [0.6, 0.6, 0.65],
    radiusKm: 788.4,
    explorerVisualRadius: 0.09,
    orbitDistanceKm: 435_910,
    explorerOrbitVisualRadius: 2.0,
    siderealOrbitPeriodDays: 8.706234,
    orbitInclinationToParentEquatorDegrees: 0.114,
    orbitAscendingNodeDegrees: 0,
  },
  {
    id: 'oberon',
    name: 'Oberon',
    parentId: 'uranus',
    color: [0.55, 0.55, 0.6],
    radiusKm: 761.4,
    explorerVisualRadius: 0.085,
    orbitDistanceKm: 583_520,
    explorerOrbitVisualRadius: 2.6,
    siderealOrbitPeriodDays: 13.463234,
    orbitInclinationToParentEquatorDegrees: 0.125,
    orbitAscendingNodeDegrees: 0,
  },
  {
    id: 'triton',
    name: 'Triton',
    parentId: 'neptune',
    color: [0.85, 0.8, 0.78],
    radiusKm: 1353.4,
    explorerVisualRadius: 0.15,
    orbitDistanceKm: 354_759,
    explorerOrbitVisualRadius: 2.1,
    siderealOrbitPeriodDays: -5.876854,
    orbitInclinationToParentEquatorDegrees: 157.3, // illustrative snapshot - real value precesses, see field doc
    orbitAscendingNodeDegrees: 0, // illustrative, see field doc
  },
]
