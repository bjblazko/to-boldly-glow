// Loads the pre-converted star catalog asset (see packages/data-pipeline) — a flat binary buffer
// of 4 floats per star (x, y, z, brightness). Any failure degrades gracefully to zero stars
// rather than blocking the app (see docs/superpowers/specs/2026-07-17-to-boldly-glow-mvp-design.md
// §6): simpler than substituting a hardcoded mini-catalog, since each star is just a procedurally
// shaded point with no per-star asset dependency of its own.
export async function loadStarCatalog(url: string): Promise<Float32Array> {
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status} loading ${url}`)
    return new Float32Array(await response.arrayBuffer())
  } catch (error) {
    console.warn(`Star catalog failed to load from ${url}; rendering with no stars.`, error)
    return new Float32Array(0)
  }
}
