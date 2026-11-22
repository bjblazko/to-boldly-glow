// Reads JPL Horizons' vector tables (ecliptic and mean equinox of J2000 - the frame of the app's
// VSOP87 planets; heliocentric in AU and AU/day unless asked otherwise) for a spacecraft. Horizons' suggested citation:
// "Giorgini, JD and JPL Solar System Dynamics Group, NASA/JPL Horizons On-Line Ephemeris System,
// https://ssd.jpl.nasa.gov/horizons/, data retrieved YYYY-MON-DD." (see CREDITS.md).

export interface StateVector {
  julianDay: number
  position: [number, number, number]
  velocity: [number, number, number]
}

export interface VectorQuery {
  start: string
  stop: string
  step: string
  // The body positions are relative to (Horizons' notation; the Sun's centre if not given).
  center?: string
  units?: 'AU-D' | 'KM-S'
  // The frame's plane: the ecliptic (default) or Earth's mean equator of J2000 ('FRAME').
  plane?: 'ECLIPTIC' | 'FRAME'
  // Output times in UT instead of TDB.
  universalTime?: boolean
}

export function horizonsVectorsUrl(target: string, { start, stop, step, center = '500@10', units = 'AU-D', plane = 'ECLIPTIC', universalTime = false }: VectorQuery): string {
  const parameters: Record<string, string> = {
    format: 'text',
    COMMAND: `'${target}'`,
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'VECTORS'",
    CENTER: `'${center}'`,
    REF_PLANE: `'${plane}'`,
    REF_SYSTEM: "'J2000'",
    START_TIME: `'${start}'`,
    STOP_TIME: `'${stop}'`,
    STEP_SIZE: `'${step}'`,
    VEC_TABLE: "'2'",
    OUT_UNITS: `'${units}'`,
    CSV_FORMAT: "'YES'",
    ...(universalTime ? { TIME_TYPE: "'UT'" } : {}),
  }
  return `https://ssd.jpl.nasa.gov/api/horizons.api?${new URLSearchParams(parameters).toString()}`
}

// The rows between $$SOE and $$EOE: JD, calendar date, X, Y, Z, VX, VY, VZ.
export function parseHorizonsVectors(text: string): StateVector[] {
  const start = text.indexOf('$$SOE')
  const end = text.indexOf('$$EOE')
  if (start < 0 || end < 0) throw new Error(`No ephemeris in Horizons' answer: ${text.slice(0, 400)}`)
  return text
    .slice(start + 5, end)
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      const fields = line.split(',').map((field) => field.trim())
      const number = (index: number) => Number(fields[index])
      return { julianDay: number(0), position: [number(2), number(3), number(4)], velocity: [number(5), number(6), number(7)] }
    })
}
