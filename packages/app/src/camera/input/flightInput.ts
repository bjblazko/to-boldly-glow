import type { FlightCommand } from '../flyCamera'
import type { KeyboardState } from './keyboardState'

// The keyboard's flight controls: WASD or the arrow keys to fly and strafe, R/F up and down
// (Space stays free to press focused buttons), Q/E to roll, Shift to boost.
export function keyboardFlightCommand(keys: KeyboardState): FlightCommand {
  return {
    thrust: [
      keys.axis(['KeyD', 'ArrowRight'], ['KeyA', 'ArrowLeft']),
      keys.axis(['KeyR', 'PageUp'], ['KeyF', 'PageDown']),
      keys.axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']),
    ],
    roll: keys.axis(['KeyE'], ['KeyQ']),
    boost: keys.isDown('ShiftLeft', 'ShiftRight'),
  }
}

// Keyboard and touch controls together, each axis limited to full thrust.
export function combineCommands(a: FlightCommand, b: FlightCommand): FlightCommand {
  const axis = (i: number) => Math.min(Math.max(a.thrust[i] + b.thrust[i], -1), 1)
  return { thrust: [axis(0), axis(1), axis(2)], roll: Math.min(Math.max(a.roll + b.roll, -1), 1), boost: a.boost || b.boost }
}

// In orbit mode the same keys turn the view around its target (pixels of drag per second) and
// R/F zoom in and out (factor e per second).
export const ORBIT_KEY_TURN_PX_PER_SECOND = 420
export const ORBIT_KEY_ZOOM_PER_SECOND = 1.2

export function keyboardOrbitTurn(keys: KeyboardState): { turn: [number, number]; zoom: number } {
  return {
    turn: [keys.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']), keys.axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown'])],
    zoom: keys.axis(['KeyF', 'Minus', 'NumpadSubtract'], ['KeyR', 'Equal', 'NumpadAdd']),
  }
}
