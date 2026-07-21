// A named latitude the lesson can frame — e.g. the Arctic Circle. `text`, if present, overrides
// the chapter's own generic text() for this specific latitude (e.g. "the sun never sets here in
// June"); chapters fall back to their own text() when a preset has none.
export interface LatitudePreset {
  id: string
  label: string
  latitudeDegrees: number
  text?: (scrubT: number) => string
}

// The camera framing a chapter is entered with. `date` is used ONLY to compute the framing
// target (Earth's real world position on that date) - it is independent of the chapter's own
// `dateRange` scrub window, and is deliberately re-derived at runtime (via entityWorldPosition,
// see learn/lessonPlayer.ts) rather than baked into a literal scene-unit position. A literal
// [x, y, z] target or a literal scene-unit radius would only be correct for whichever
// Realistic/Compact scale blend was active when the numbers were chosen; deriving both from
// Earth's own real position/radius at the current scale keeps the framing correct regardless of
// which scale the user had selected before entering the lesson (this refines the design spec's
// §8 data model, which sketched a literal target/radius pair before this constraint was worked
// through at plan time).
export interface ChapterCameraFraming {
  date: Date
  radiusMultiplier: number // multiples of Earth's own current scaled radius - mirrors
                            // cameraFollow.ts's FRAMING_RADIUS_MULTIPLIER pattern
  azimuth: number // radians
  elevation: number // radians
  upAxis: readonly [number, number, number]
}

export interface Chapter {
  id: string
  title: string
  dateRange: readonly [Date, Date] // real calendar dates the scrub bar interpolates across
  cameraFraming: ChapterCameraFraming
  text: (scrubT: number, latitude: LatitudePreset) => string
}

export interface Lesson {
  id: string
  title: string
  chapters: Chapter[]
  latitudePresets: LatitudePreset[]
}

// Maps a chapter-local scrub position (clamped to [0, 1]) to a real calendar date within the
// chapter's dateRange, linearly.
export function dateAtScrubPosition(dateRange: readonly [Date, Date], scrubT: number): Date {
  const clamped = Math.min(Math.max(scrubT, 0), 1)
  const startMs = dateRange[0].getTime()
  const endMs = dateRange[1].getTime()
  return new Date(startMs + (endMs - startMs) * clamped)
}
