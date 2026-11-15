// How the Golden Record stores a picture as sound, as its cover shows: the picture is read line by
// line, each line a short pulse to mark its start and then the brightness along it as the height of
// the signal - like an old television signal. Played back, the lines are drawn one under another.
// The picture here is our own (the cover's test circle), not one of the record's.

export const PICTURE_WIDTH = 96
export const PICTURE_HEIGHT = 72
// The pulse that starts each line, in samples: below black, so it can't be mistaken for a pixel.
export const SYNC_SAMPLES = 12
export const SYNC_LEVEL = -1
export const LINE_SAMPLES = SYNC_SAMPLES + PICTURE_WIDTH

// The cover's first picture: a bright circle in a dark frame. Brightness 0 (black) to 1 (white).
export function testPicture(width = PICTURE_WIDTH, height = PICTURE_HEIGHT): Float32Array {
  const pixels = new Float32Array(width * height)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) pixels[y * width + x] = testPixel(x, y, width, height)
  return pixels
}

// A pixel of the test picture: on the circle, on the frame, or the dark background.
function testPixel(x: number, y: number, width: number, height: number): number {
  const distance = Math.hypot(x + 0.5 - width / 2, y + 0.5 - height / 2)
  const ring = Math.max(0, 1 - Math.abs(distance - height * 0.32) / 2.2)
  const onFrame = Math.min(x, y, width - 1 - x, height - 1 - y) < 2
  return Math.max(ring, onFrame ? 1 : 0, 0.08)
}

// One line after another, each with its sync pulse in front.
export function encodePicture(pixels: Float32Array, width: number): Float32Array {
  const lines = pixels.length / width
  const signal = new Float32Array(lines * (SYNC_SAMPLES + width))
  for (let line = 0; line < lines; line++) {
    const start = line * (SYNC_SAMPLES + width)
    signal.fill(SYNC_LEVEL, start, start + SYNC_SAMPLES)
    signal.set(pixels.subarray(line * width, (line + 1) * width), start + SYNC_SAMPLES)
  }
  return signal
}

// A line's brightness back out of the signal: what follows its sync pulse.
export function decodeLine(signal: Float32Array, line: number, width: number): Float32Array {
  const start = line * (SYNC_SAMPLES + width) + SYNC_SAMPLES
  return signal.slice(start, start + width)
}
