import { describe, expect, it } from 'vitest'
import { GLIDE_SECONDS } from '../src/learn/lessonCamera'
import { LineupArrangement } from '../src/learn/sizes/lineupArrangement'
import { lineupSlot, OUT_FROM_SUN } from '../src/learn/sizes/sizesLineup'

const BY_SIZE = ['jupiter', 'saturn', 'uranus', 'neptune', 'earth', 'venus', 'mars', 'mercury']

describe('LineupArrangement', () => {
  it('stands the planets out from the Sun to begin with', () => {
    const lineup = new LineupArrangement()
    for (const id of OUT_FROM_SUN) expect(lineup.position(id)).toEqual([lineupSlot(id).x, 0, 0])
  })

  it('puts them in their new places at once, unless asked to move them', () => {
    const lineup = new LineupArrangement()
    lineup.arrange(BY_SIZE)
    expect(lineup.order).toEqual(BY_SIZE)
    expect(lineup.position('jupiter')).toEqual([lineupSlot('jupiter', BY_SIZE).x, 0, 0])
  })

  it('moves them there in an arc in the time the camera flies, the planet in focus along the row', () => {
    const lineup = new LineupArrangement()
    lineup.arrange(BY_SIZE, { animate: true, focusPlanetId: 'earth' })
    expect(lineup.position('jupiter')).toEqual([lineupSlot('jupiter').x, 0, 0])
    lineup.update(GLIDE_SECONDS / 2)
    // Jupiter comes toward the Sun (+X), so it passes under the row; Mercury goes away, over it.
    expect(lineup.position('jupiter')[2]).toBeLessThan(-lineupSlot('jupiter').radius * 2)
    expect(lineup.position('mercury')[2]).toBeGreaterThan(lineupSlot('jupiter').radius)
    expect(lineup.position('earth')[2]).toBe(0)
    lineup.update(GLIDE_SECONDS / 2)
    for (const id of BY_SIZE) {
      const [x, y, z] = lineup.position(id)
      expect(x, id).toBeCloseTo(lineupSlot(id, BY_SIZE).x, 12)
      expect([y, z].map(Math.abs), id).toEqual([0, expect.closeTo(0, 12)])
    }
  })

  it('turns around smoothly when the order changes again on the way', () => {
    const lineup = new LineupArrangement()
    lineup.arrange(BY_SIZE, { animate: true })
    lineup.update(GLIDE_SECONDS / 3)
    const halfway = lineup.position('jupiter')
    lineup.arrange(OUT_FROM_SUN, { animate: true })
    expect(lineup.position('jupiter')).toEqual(halfway)
  })
})
