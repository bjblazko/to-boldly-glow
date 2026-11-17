import { describe, expect, it } from 'vitest'
import { padCommand } from '../src/hud/touchFlightPad'

describe('padCommand', () => {
  it('steers the nose with the stick, like the arrows: pushed up is nose down', () => {
    expect(padCommand({ stick: [0.5, 1], thrust: 0, roll: 0, boost: false }).turn).toEqual([0.5, -1])
  })

  it('passes the thrust, roll and boost buttons through', () => {
    const command = padCommand({ stick: [0, 0], thrust: -1, roll: 1, boost: true })
    expect([command.thrust, command.roll, command.boost]).toEqual([-1, 1, true])
  })
})
