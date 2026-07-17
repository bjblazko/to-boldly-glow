// Julian Day algorithm (Gregorian calendar), per Jean Meeus, "Astronomical Algorithms", ch. 7.
export function calendarToJulianDay(year: i32, month: i32, day: f64): f64 {
  let y = year
  let m = month
  if (m <= 2) {
    y -= 1
    m += 12
  }
  const a = Math.floor(f64(y) / 100.0)
  const b = 2.0 - a + Math.floor(a / 4.0)
  return (
    Math.floor(365.25 * f64(y + 4716)) +
    Math.floor(30.6001 * f64(m + 1)) +
    day +
    b -
    1524.5
  )
}

export function daysSinceJ2000(julianDay: f64): f64 {
  return julianDay - 2451545.0
}
