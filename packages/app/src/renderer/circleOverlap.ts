// Area of overlap between two circles of radii r1, r2 (screen-space pixels here) whose centers
// are distance d apart, divided by circle 1's own area — the fraction of circle 1 covered by
// circle 2. Mirrors the WGSL `circleOverlapArea`/`sunVisibleFraction` functions in
// renderer/shaders.ts (angular-space there, screen-space pixels here) — the same algorithm
// implemented once per language since WGSL and TS can't share code; keep the two in sync if the
// formula is ever tuned.
export function circleOverlapFraction(r1: number, r2: number, d: number): number {
  if (r1 <= 0) return 0
  if (r2 <= 0 || d >= r1 + r2) return 0
  const rmin = Math.min(r1, r2)
  const rmax = Math.max(r1, r2)
  let area: number
  if (d <= rmax - rmin) {
    area = Math.PI * rmin * rmin
  } else {
    const clamp = (x: number) => Math.max(-1, Math.min(1, x))
    const d1 = clamp((d * d + r1 * r1 - r2 * r2) / (2 * d * r1))
    const d2 = clamp((d * d + r2 * r2 - r1 * r1) / (2 * d * r2))
    const term1 = r1 * r1 * Math.acos(d1)
    const term2 = r2 * r2 * Math.acos(d2)
    const term3 = 0.5 * Math.sqrt(Math.max(0, (-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2)))
    area = term1 + term2 - term3
  }
  return area / (Math.PI * r1 * r1)
}
