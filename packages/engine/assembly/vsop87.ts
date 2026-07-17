// Evaluates one VSOP87 periodic-term series: sum of amplitude * cos(phase + frequency * T),
// where `terms` is a flat array of [amplitude, phase, frequency] triples.
function evalVsop87Series(terms: f64[], T: f64): f64 {
  let sum: f64 = 0.0
  const termCount = terms.length / 3
  for (let i = 0; i < termCount; i++) {
    const amplitude = terms[i * 3]
    const phase = terms[i * 3 + 1]
    const frequency = terms[i * 3 + 2]
    sum += amplitude * Math.cos(phase + frequency * T)
  }
  return sum
}

// Evaluates a full VSOP87 coordinate (L, B, or R) as a power series in T: each entry in `orders`
// is one order's term series (order 0 = constant term, order 1 = coefficient of T, etc.),
// summed as orders[0] + orders[1]*T + orders[2]*T^2 + ...
export function evalVsop87Coordinate(orders: f64[][], T: f64): f64 {
  let total: f64 = 0.0
  let Tpower: f64 = 1.0
  for (let n = 0; n < orders.length; n++) {
    total += evalVsop87Series(orders[n], T) * Tpower
    Tpower *= T
  }
  return total
}
