import { describe, expect, it } from 'vitest'
import { decodeLine, encodePicture, LINE_SAMPLES, PICTURE_HEIGHT, PICTURE_WIDTH, SYNC_LEVEL, SYNC_SAMPLES, testPicture } from '../src/learn/voyager/pictureSignal'

describe('a picture stored as sound', () => {
  const picture = testPicture()
  const signal = encodePicture(picture, PICTURE_WIDTH)

  it('starts every line with a sync pulse below black', () => {
    expect(signal.length).toBe(PICTURE_HEIGHT * LINE_SAMPLES)
    for (let line = 0; line < PICTURE_HEIGHT; line++) expect([...signal.subarray(line * LINE_SAMPLES, line * LINE_SAMPLES + SYNC_SAMPLES)].every((value) => value === SYNC_LEVEL)).toBe(true)
  })

  it('gives every line back as it was', () => {
    for (const line of [0, PICTURE_HEIGHT / 2, PICTURE_HEIGHT - 1]) {
      expect([...decodeLine(signal, line, PICTURE_WIDTH)]).toEqual([...picture.subarray(line * PICTURE_WIDTH, (line + 1) * PICTURE_WIDTH)])
    }
  })

  it('draws the cover’s circle: bright on its ring, dark inside', () => {
    const middle = (PICTURE_HEIGHT / 2) * PICTURE_WIDTH
    expect(picture[middle + PICTURE_WIDTH / 2]).toBeLessThan(0.2)
    expect(Math.max(...picture.subarray(middle, middle + PICTURE_WIDTH / 2))).toBeGreaterThan(0.9)
  })
})
