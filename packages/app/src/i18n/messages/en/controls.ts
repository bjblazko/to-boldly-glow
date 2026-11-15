// How to steer, for the About dialog: per situation, per device, what does what. Keep it in step
// with camera/inputController.ts, camera/input/flightInput.ts, hud/touchFlightPad.ts and the
// shortcuts in hud/ (palette, interface visibility).

type Row = [action: string, how: string]

export const controls = {
  title: 'Controls',
  intro: 'The Camera panel (dock, bottom) switches between orbiting a body and free flight.',
  sections: [
    {
      title: 'Orbiting a body',
      devices: [
        { device: 'Mouse', rows: [['Turn around it', 'Drag'], ['Zoom', 'Scroll wheel'], ['Fly to a body and follow it', 'Double-click it']] as Row[] },
        { device: 'Trackpad', rows: [['Turn around it', 'Two-finger swipe'], ['Zoom', 'Pinch'], ['Fly to a body', 'Double-click it']] as Row[] },
        { device: 'Touch', rows: [['Turn around it', 'Drag with one finger'], ['Zoom', 'Pinch'], ['Fly to a body', 'Double-tap it']] as Row[] },
        { device: 'Keyboard', rows: [['Turn around it', 'W A S D or the arrow keys'], ['Zoom in / out', 'R / F (or + / -)']] as Row[] },
      ],
    },
    {
      title: 'Free flight',
      devices: [
        { device: 'Keyboard', rows: [['Forward / back', 'W / S or ↑ / ↓'], ['Sideways', 'A / D or ← / →'], ['Up / down', 'R / F (or Page Up / Page Down)'], ['Roll', 'Q / E'], ['Boost', 'hold Shift']] as Row[] },
        { device: 'Mouse and trackpad', rows: [['Look around', 'Drag'], ['Cruising speed', 'Scroll']] as Row[] },
        { device: 'Touch', rows: [['Fly and move sideways', 'The stick, bottom left'], ['Up, down, boost', 'Hold the buttons on the right'], ['Look around', 'Drag anywhere else'], ['Cruising speed', 'Pinch']] as Row[] },
      ],
    },
    {
      title: 'Lessons and tours',
      devices: [
        {
          device: 'All',
          rows: [
            ['Look around a lesson’s scene', 'Drag (a little), zoom buttons on the right'],
            ['Back to the lesson’s view', 'The reset button on the right'],
            ['Turn the pages by themselves', 'Play, in the lesson dock'],
            ['Pause, skip or leave a mission tour', 'Its timeline at the bottom; Esc leaves'],
          ] as Row[],
        },
      ],
    },
    {
      title: 'Anywhere',
      devices: [
        {
          device: 'Keyboard',
          rows: [
            ['Search everything', 'Ctrl+K (⌘K on a Mac)'],
            ['Hide or show the interface', 'H'],
            ['Close a panel or dialog', 'Esc'],
            ['Stop the camera tour', 'Any key, click or scroll on the scene'],
          ] as Row[],
        },
      ],
    },
  ],
}
