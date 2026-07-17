// Converts a spherical position (ecliptic longitude/latitude, radius) to rectangular
// coordinates in the same reference frame. longitude and latitude are in radians.
export function sphericalToX(longitude: f64, latitude: f64, radius: f64): f64 {
  return radius * Math.cos(latitude) * Math.cos(longitude)
}

export function sphericalToY(longitude: f64, latitude: f64, radius: f64): f64 {
  return radius * Math.cos(latitude) * Math.sin(longitude)
}

export function sphericalToZ(longitude: f64, latitude: f64, radius: f64): f64 {
  return radius * Math.sin(latitude)
}
