// A PDS3 label (the text head of an LROC product, or its detached .LBL): `KEY = value` lines, a
// quoted value running on over several lines, units in angle brackets. Read as untrusted text:
// only its keys and values are kept, nothing in it is run.

export type Label = Record<string, string>

export function parseLabel(text: string): Label {
  const label: Label = {}
  let open: { key: string; parts: string[] } | null = null
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    if (raw.trim() === 'END') break
    if (open) {
      open.parts.push(raw.trim())
      if (raw.includes('"')) open = close(label, open)
      continue
    }
    const match = /^\s*([A-Z0-9_^:]+)\s*=\s*(.*)$/.exec(raw)
    if (!match) continue
    const [, key, value] = match
    if (value.startsWith('"') && !value.slice(1).includes('"')) open = { key, parts: [value] }
    else label[key] = unquoted(value)
  }
  return label
}

function close(label: Label, open: { key: string; parts: string[] }): null {
  label[open.key] = unquoted(open.parts.join(' '))
  return null
}

// A value without its quotes and its unit ("2.0 <METERS/PIXEL>" -> "2.0").
function unquoted(value: string): string {
  const trimmed = value.trim()
  if (trimmed.startsWith('"')) return trimmed.slice(1, trimmed.lastIndexOf('"')).replace(/\s+/g, ' ')
  return trimmed.replace(/\s*<[^>]*>$/, '')
}

// LROC's equirectangular map: x east = R cos(centre latitude) (longitude - centre longitude),
// y north = R latitude (radians); a pixel's line and sample (0 = the first pixel's centre) are its
// offsets from the projection's origin, in map scale, as the label's note defines them.
export interface MapGeometry {
  radius: number // metres
  scale: number // metres per pixel
  centerLatitude: number // degrees
  centerLongitude: number
  lineOffset: number
  sampleOffset: number
}

export function mapGeometry(label: Label): MapGeometry {
  const number = (key: string) => {
    const value = Number.parseFloat(label[key])
    if (!Number.isFinite(value)) throw new Error(`PDS label: no ${key}`)
    return value
  }
  return {
    radius: number('A_AXIS_RADIUS') * 1000,
    scale: number('MAP_SCALE'),
    centerLatitude: number('CENTER_LATITUDE'),
    centerLongitude: number('CENTER_LONGITUDE'),
    lineOffset: number('LINE_PROJECTION_OFFSET'),
    sampleOffset: number('SAMPLE_PROJECTION_OFFSET'),
  }
}

const DEG = Math.PI / 180

export function pixelOf(geometry: MapGeometry, latitude: number, longitude: number): { line: number; sample: number } {
  const { radius, scale, centerLatitude, centerLongitude, lineOffset, sampleOffset } = geometry
  const x = radius * Math.cos(centerLatitude * DEG) * (longitude - centerLongitude) * DEG
  const y = radius * latitude * DEG
  return { line: lineOffset - y / scale, sample: sampleOffset + x / scale }
}

// The other way: a pixel's latitude and longitude (degrees).
export function placeOf(geometry: MapGeometry, line: number, sample: number): { latitude: number; longitude: number } {
  const { radius, scale, centerLatitude, centerLongitude, lineOffset, sampleOffset } = geometry
  return {
    latitude: ((lineOffset - line) * scale) / radius / DEG,
    longitude: centerLongitude + ((sample - sampleOffset) * scale) / (radius * Math.cos(centerLatitude * DEG)) / DEG,
  }
}
