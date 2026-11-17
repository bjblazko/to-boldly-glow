import type { CameraMode } from '../camera/inputController'
import type { Messages } from '../i18n/messages/en'

type ControlTexts = Messages['ui']['controls']

// A key as drawn on the overlay: the key code it lights up for, and what its cap says.
export interface KeyCap {
  code: string
  label: string
  wide?: boolean
}

// One thing the overlay explains: keys laid out in rows as on a keyboard (null leaves a gap), or
// gestures, and what they do.
export interface ControlGroup {
  keys: (KeyCap | null)[][]
  gestures: string[]
  caption: string
}

const cap = (code: string, label: string, wide = false): KeyCap => ({ code, label, wide })
const ARROWS: (KeyCap | null)[][] = [
  [null, cap('ArrowUp', '↑'), null],
  [cap('ArrowLeft', '←'), cap('ArrowDown', '↓'), cap('ArrowRight', '→')],
]
const keys = (rows: (KeyCap | null)[][], caption: string): ControlGroup => ({ keys: rows, gestures: [], caption })
const gesture = (names: string[], caption: string): ControlGroup => ({ keys: [], gestures: names, caption })

// What the overlay shows for a camera mode: keyboard and mouse, or a touch screen's fingers.
export function controlGroups(mode: CameraMode, touch: boolean, text: ControlTexts): ControlGroup[] {
  const { gestures: g, orbit, fly } = text
  if (mode === 'orbit') {
    const pointing = touch
      ? [gesture([g.drag], orbit.turn), gesture([g.twoFingers], orbit.move), gesture([g.pinch], orbit.zoom), gesture([g.doubleTap], orbit.flyTo)]
      : [gesture([g.drag], orbit.turn), gesture([g.twoFingers, g.rightDrag], orbit.move), gesture([g.scroll, g.pinch], orbit.zoom), gesture([g.doubleClick], orbit.flyTo)]
    return touch ? pointing : [...pointing, keys(ARROWS, orbit.keysTurn), keys([[cap('KeyW', 'W')], [cap('KeyS', 'S')]], orbit.keysZoom)]
  }
  if (touch) return [gesture([g.stick], fly.steer), gesture([g.thrust], fly.thrust), gesture([g.roll], fly.roll), gesture([g.boost], fly.boost), gesture([g.drag], fly.look), gesture([g.twoFingers], fly.speed)]
  return [
    keys([[cap('KeyQ', 'Q'), cap('KeyW', 'W'), cap('KeyE', 'E')], [null, cap('KeyS', 'S'), null]], fly.rollThrust),
    keys(ARROWS, fly.steer),
    keys([[cap('ShiftLeft', '⇧ Shift', true)]], fly.boost),
    gesture([g.drag], fly.look),
    gesture([g.scroll], fly.speed),
  ]
}
