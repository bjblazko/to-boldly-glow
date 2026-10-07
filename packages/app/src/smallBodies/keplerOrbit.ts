import type { AuPosition } from '../solarSystem/sceneScale'
import type { Vec3 } from '../math/tuples'

// The Gaussian gravitational constant: a body on a 1 AU circular orbit moves this many radians per
// day. Mean motion n = k / a^1.5 (the small bodies' own mass is negligible).
export const GAUSSIAN_GRAVITATIONAL_CONSTANT = 0.01720209895

const RADIANS = Math.PI / 180

// A Keplerian orbit around the Sun, referred to the J2000 ecliptic - the scene's frame. Real small
// bodies are nudged by the planets, so osculating elements like these drift by a few degrees over
// decades: good enough to put a comet in the right part of the sky, not to predict an occultation.
export interface OrbitalElements {
  semiMajorAxisAu: number
  eccentricity: number
  inclinationDegrees: number
  ascendingNodeDegrees: number
  perihelionArgumentDegrees: number
  // When the body passes perihelion, in days since J2000.0 (any passage will do).
  perihelionDaysSinceJ2000: number
}

export function meanMotionRadiansPerDay(semiMajorAxisAu: number): number {
  return GAUSSIAN_GRAVITATIONAL_CONSTANT / semiMajorAxisAu ** 1.5
}

export function orbitalPeriodDays(semiMajorAxisAu: number): number {
  return (2 * Math.PI) / meanMotionRadiansPerDay(semiMajorAxisAu)
}

// Kepler's equation M = E - e sin E, solved for the eccentric anomaly E by Newton's method. The
// starting guess (Danby's) converges even for the near-parabolic orbits of long-period comets.
export function eccentricAnomaly(meanAnomaly: number, eccentricity: number): number {
  const M = Math.atan2(Math.sin(meanAnomaly), Math.cos(meanAnomaly))
  let E = M + Math.sign(M) * 0.85 * eccentricity
  for (let iteration = 0; iteration < 50; iteration++) {
    const step = (E - eccentricity * Math.sin(E) - M) / (1 - eccentricity * Math.cos(E))
    E -= step
    if (Math.abs(step) < 1e-12) break
  }
  return E
}

// Position on the orbit at a given eccentric anomaly, in AU in the scene's ecliptic frame.
export function positionAtEccentricAnomaly(elements: OrbitalElements, E: number): AuPosition {
  const a = elements.semiMajorAxisAu
  const e = elements.eccentricity
  // In the orbital plane, x toward perihelion.
  const xOrbit = a * (Math.cos(E) - e)
  const yOrbit = a * Math.sqrt(1 - e * e) * Math.sin(E)
  const [x, y, z] = orbitPlaneToEcliptic(elements, xOrbit, yOrbit)
  return { x, y, z, distanceAu: Math.hypot(xOrbit, yOrbit) }
}

export function heliocentricPosition(elements: OrbitalElements, daysSinceJ2000: number): AuPosition {
  const meanAnomaly = meanMotionRadiansPerDay(elements.semiMajorAxisAu) * (daysSinceJ2000 - elements.perihelionDaysSinceJ2000)
  return positionAtEccentricAnomaly(elements, eccentricAnomaly(meanAnomaly, elements.eccentricity))
}

// The direction the body is moving (unit vector) - which way a comet's dust tail curves back from.
export function motionDirection(elements: OrbitalElements, daysSinceJ2000: number): Vec3 {
  const meanAnomaly = meanMotionRadiansPerDay(elements.semiMajorAxisAu) * (daysSinceJ2000 - elements.perihelionDaysSinceJ2000)
  const E = eccentricAnomaly(meanAnomaly, elements.eccentricity)
  const e = elements.eccentricity
  // d/dE of the in-plane position; dE/dt is positive, so this points along the motion.
  const [x, y, z] = orbitPlaneToEcliptic(elements, -Math.sin(E), Math.sqrt(1 - e * e) * Math.cos(E))
  const length = Math.hypot(x, y, z)
  return [x / length, y / length, z / length]
}

// Points around the whole orbit, closed (the last point repeats the first). Half are spaced evenly
// in eccentric anomaly, which covers the long outer arcs, half evenly in true anomaly, which covers
// the tight turn at perihelion - a comet rounds the Sun within a few degrees of eccentric anomaly.
export function sampleOrbit(elements: OrbitalElements, count: number): AuPosition[] {
  const half = Math.max(Math.floor(count / 2), 2)
  const e = elements.eccentricity
  const byEccentricAnomaly = Array.from({ length: half }, (_, i) => (i / half) * 2 * Math.PI - Math.PI)
  const byTrueAnomaly = Array.from({ length: half }, (_, i) => {
    const trueAnomaly = (i / half) * 2 * Math.PI - Math.PI
    return 2 * Math.atan(Math.sqrt((1 - e) / (1 + e)) * Math.tan(trueAnomaly / 2))
  })
  const anomalies = [...byEccentricAnomaly, ...byTrueAnomaly].filter(Number.isFinite).sort((a, b) => a - b)
  return [...anomalies, anomalies[0] + 2 * Math.PI].map((E) => positionAtEccentricAnomaly(elements, E))
}

// Rotates an orbital-plane vector (x toward perihelion) by the argument of perihelion, the
// inclination and the longitude of the ascending node into the ecliptic frame.
function orbitPlaneToEcliptic(elements: OrbitalElements, xOrbit: number, yOrbit: number): Vec3 {
  const w = elements.perihelionArgumentDegrees * RADIANS
  const i = elements.inclinationDegrees * RADIANS
  const node = elements.ascendingNodeDegrees * RADIANS
  const [cw, sw, ci, si, cn, sn] = [Math.cos(w), Math.sin(w), Math.cos(i), Math.sin(i), Math.cos(node), Math.sin(node)]
  const xNode = cw * xOrbit - sw * yOrbit
  const yNode = sw * xOrbit + cw * yOrbit
  return [cn * xNode - sn * ci * yNode, sn * xNode + cn * ci * yNode, si * yNode]
}

// Elements from a comet catalog's perihelion distance q and perihelion date.
export function fromPerihelion(
  perihelionAu: number,
  eccentricity: number,
  angles: { inclinationDegrees: number; ascendingNodeDegrees: number; perihelionArgumentDegrees: number },
  perihelionDate: string,
): OrbitalElements {
  return {
    semiMajorAxisAu: perihelionAu / (1 - eccentricity),
    eccentricity,
    ...angles,
    perihelionDaysSinceJ2000: (Date.parse(perihelionDate) - J2000_UNIX_MS) / 86400000,
  }
}

// J2000.0 = 2000-01-01 12:00 TT; the minute between TT and UTC makes no visible difference here.
const J2000_UNIX_MS = Date.UTC(2000, 0, 1, 12)
