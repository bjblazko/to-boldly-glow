import { describe, expect, it } from 'vitest'
import { controlGroups, type ControlGroup } from '../src/hud/controlsGuide'
import { messagesFor } from '../src/i18n/i18n'

const text = messagesFor('en').ui.controls
const codes = (groups: ControlGroup[]) => groups.flatMap((group) => group.keys.flat().filter((cap) => cap !== null).map((cap) => cap.code))
const gestures = (groups: ControlGroup[]) => groups.flatMap((group) => group.gestures)

describe('controlGroups', () => {
  it('shows free flight as a spaceship: the arrows, Q W E S and Shift - no strafing keys', () => {
    const shown = codes(controlGroups('fly', false, text))
    expect(shown).toEqual(expect.arrayContaining(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyQ', 'KeyW', 'KeyE', 'KeyS', 'ShiftLeft']))
    expect(shown).not.toEqual(expect.arrayContaining(['KeyA']))
    expect(shown).not.toEqual(expect.arrayContaining(['KeyR']))
  })

  it('shows the orbit camera with its gestures, the arrows to turn and W/S to zoom', () => {
    const groups = controlGroups('orbit', false, text)
    expect(codes(groups)).toEqual(expect.arrayContaining(['ArrowLeft', 'ArrowRight', 'KeyW', 'KeyS']))
    expect(gestures(groups)).toEqual(expect.arrayContaining([text.gestures.drag, text.gestures.twoFingers, text.gestures.scroll]))
  })

  it('shows no keys on a touch screen, only what the fingers do', () => {
    expect(codes(controlGroups('orbit', true, text))).toEqual([])
    expect(codes(controlGroups('fly', true, text))).toEqual([])
    expect(gestures(controlGroups('orbit', true, text))).toEqual(expect.arrayContaining([text.gestures.pinch]))
  })

  it('lays the keys out as on a keyboard: Q W E over S, the arrow cluster', () => {
    const fly = controlGroups('fly', false, text)
    const rows = (code: string) => fly.find((group) => group.keys.flat().some((cap) => cap?.code === code))!.keys
    expect(rows('KeyW').map((row) => row.map((cap) => cap?.label ?? null))).toEqual([
      ['Q', 'W', 'E'],
      [null, 'S', null],
    ])
    expect(rows('ArrowUp').map((row) => row.map((cap) => cap?.label ?? null))).toEqual([
      [null, '↑', null],
      ['←', '↓', '→'],
    ])
  })
})
