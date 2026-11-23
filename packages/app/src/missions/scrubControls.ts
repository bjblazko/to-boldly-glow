// Jog and shuttle, as on an editing desk, for the long tours: the shuttle's push sets a speed,
// forward or back (the further, the faster - from a quarter of play speed to MAX_RATE times it);
// the jog wheel steps a frame a notch (a second with Shift); J, K and L play back, stop and play
// forward, each further press of J or L doubling the speed.

export const FRAME_SECONDS = 1 / 30
export const MAX_RATE = 64
const MIN_RATE = 0.25
// Around the shuttle's middle it stands still, so letting go near it stops.
const DEAD_ZONE = 0.05

// `push`: -1 (all the way back) to 1 (all the way forward).
export function shuttleRate(push: number): number {
  const amount = Math.min(1, Math.abs(push))
  if (amount < DEAD_ZONE) return 0
  return Math.sign(push) * MIN_RATE * (MAX_RATE / MIN_RATE) ** ((amount - DEAD_ZONE) / (1 - DEAD_ZONE))
}

export function jklRate(rate: number, key: 'j' | 'k' | 'l'): number {
  if (key === 'k') return 0
  const sign = key === 'l' ? 1 : -1
  if (Math.sign(rate) !== sign) return sign
  return sign * Math.min(MAX_RATE, Math.abs(rate) * 2)
}

export function jogSeconds(notches: number, coarse: boolean): number {
  return notches * (coarse ? 1 : FRAME_SECONDS)
}

// "mm:ss:ff" - minutes, seconds and frames of the tour.
export function timecode(seconds: number): string {
  const frames = Math.floor(Math.max(0, seconds) / FRAME_SECONDS + 1e-6)
  const [m, s, f] = [Math.floor(frames / 1800), Math.floor(frames / 30) % 60, frames % 30]
  return [m, s, f].map((value) => String(value).padStart(2, '0')).join(':')
}
