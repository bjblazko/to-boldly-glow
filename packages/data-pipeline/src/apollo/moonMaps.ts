// The region round Tranquility Base the tour flies over low (degrees): from where Columbia comes
// round the limb to well past the site, a band about the equator its orbit stays near.
export const REGION = { west: -10, east: 60, south: -10, north: 12 }

// The pixels of an equirectangular whole-Moon map (longitude -180..180 left to right, latitude 90..
// -90 top to bottom) that hold the region.
export function regionPixels(width: number, height: number): { left: number; top: number; width: number; height: number } {
  const x = (lon: number) => Math.round(((lon + 180) / 360) * width)
  const y = (lat: number) => Math.round(((90 - lat) / 180) * height)
  return { left: x(REGION.west), top: y(REGION.north), width: x(REGION.east) - x(REGION.west), height: y(REGION.south) - y(REGION.north) }
}
