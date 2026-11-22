import { describe, expect, it } from 'vitest'
import { weather } from '../src/apollo/weathering'

const [WIDTH, HEIGHT] = [256, 1024]
const white = () => new Uint8Array(WIDTH * HEIGHT * 3).fill(240)
const luminance = (pixels: Uint8Array, rows: [number, number]) => {
  let sum = 0
  for (let row = rows[0]; row < rows[1]; row++) for (let i = row * WIDTH * 3; i < (row + 1) * WIDTH * 3; i++) sum += pixels[i]
  return sum / ((rows[1] - rows[0]) * WIDTH * 3)
}

describe('the Saturn V’s wear', () => {
  it('comes out the same every time', () => {
    expect(weather(white(), WIDTH, HEIGHT)).toEqual(weather(white(), WIDTH, HEIGHT))
  })

  it('only dulls the white a little, and darkens the base most (soot and the flame trench’s dust)', () => {
    const worn = weather(white(), WIDTH, HEIGHT)
    const middle = luminance(worn, [400, 600])
    expect(middle).toBeLessThan(240)
    expect(middle).toBeGreaterThan(240 * 0.85)
    expect(luminance(worn, [HEIGHT - 40, HEIGHT])).toBeLessThan(middle - 8)
  })

  // Across the seam the paint changes no more than between any two neighbouring columns (a streak
  // may start right at it, as anywhere).
  it('wraps round the rocket without a seam', () => {
    const worn = weather(white(), WIDTH, HEIGHT)
    const typicalJump = (left: number, right: number) => {
      const jumps = Array.from({ length: HEIGHT }, (_, row) => Math.abs(worn[(row * WIDTH + left) * 3] - worn[(row * WIDTH + right) * 3])).sort((a, b) => a - b)
      return jumps[HEIGHT >> 1]
    }
    expect(typicalJump(WIDTH - 1, 0)).toBeLessThanOrEqual(typicalJump(100, 101) + 2)
  })
})
