// Computes cumulative Euclidean distance along a line-strip's points (a flat [x0,y0,z0,x1,y1,z1,...]
// array, the same shape generateOrbitPathPositions/overlay-geometry functions produce), starting
// at 0 for the first point. This is the per-vertex "distance traveled" the line shader's dash
// pattern (see lineShaderCode's dashParams) is keyed off of, uploaded as a second, parallel vertex
// buffer alongside the existing position buffer.
export function computeCumulativeLineDistances(points: Float32Array): Float32Array {
  const pointCount = points.length / 3
  const distances = new Float32Array(pointCount)
  for (let i = 1; i < pointCount; i++) {
    const dx = points[i * 3] - points[(i - 1) * 3]
    const dy = points[i * 3 + 1] - points[(i - 1) * 3 + 1]
    const dz = points[i * 3 + 2] - points[(i - 1) * 3 + 2]
    distances[i] = distances[i - 1] + Math.hypot(dx, dy, dz)
  }
  return distances
}
