import type { FlightCommand } from '../flyCamera'
import type { KeyboardState } from './keyboardState'

// The keyboard's flight controls, as in a spaceship: the arrows steer the nose (up pushes it down,
// as a stick does), W/S thrust forward and back, Q/E roll, Shift boosts. Space stays free to press
// focused buttons.
export function keyboardFlightCommand(keys: KeyboardState): FlightCommand {
  return {
    thrust: keys.axis(['KeyW'], ['KeyS']),
    turn: [keys.axis(['ArrowRight'], ['ArrowLeft']), keys.axis(['ArrowDown'], ['ArrowUp'])],
    roll: keys.axis(['KeyE'], ['KeyQ']),
    boost: keys.isDown('ShiftLeft', 'ShiftRight'),
  }
}

// Keyboard and touch controls together, each axis limited to its full value.
export function combineCommands(a: FlightCommand, b: FlightCommand): FlightCommand {
  const sum = (x: number, y: number) => Math.min(Math.max(x + y, -1), 1)
  return { thrust: sum(a.thrust, b.thrust), turn: [sum(a.turn[0], b.turn[0]), sum(a.turn[1], b.turn[1])], roll: sum(a.roll, b.roll), boost: a.boost || b.boost }
}

// In orbit mode the arrows turn the view around its pivot (pixels of drag per second), and W/S - as
// W flies forward - or +/- zoom in and out (factor e per second).
export const ORBIT_KEY_TURN_PX_PER_SECOND = 420
export const ORBIT_KEY_ZOOM_PER_SECOND = 1.2

export function keyboardOrbitTurn(keys: KeyboardState): { turn: [number, number]; zoom: number } {
  return {
    turn: [keys.axis(['ArrowLeft'], ['ArrowRight']), keys.axis(['ArrowUp'], ['ArrowDown'])],
    zoom: keys.axis(['KeyS', 'Minus', 'NumpadSubtract'], ['KeyW', 'Equal', 'NumpadAdd']),
  }
}
