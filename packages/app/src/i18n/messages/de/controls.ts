import type { Messages } from '../en'

type Row = [action: string, how: string]

export const controls: Messages['controls'] = {
  title: 'Steuerung',
  intro: 'Das Kamera-Panel (unten im Dock) wechselt zwischen dem Umkreisen eines Körpers und dem freien Flug.',
  sections: [
    {
      title: 'Einen Körper umkreisen',
      devices: [
        { device: 'Maus', rows: [['Um ihn herum drehen', 'Ziehen'], ['Zoomen', 'Mausrad'], ['Zu einem Körper fliegen und ihm folgen', 'Doppelklick darauf']] as Row[] },
        { device: 'Trackpad', rows: [['Um ihn herum drehen', 'Mit zwei Fingern wischen'], ['Zoomen', 'Zwei Finger auf- oder zuziehen'], ['Zu einem Körper fliegen', 'Doppelklick darauf']] as Row[] },
        { device: 'Touch', rows: [['Um ihn herum drehen', 'Mit einem Finger ziehen'], ['Zoomen', 'Zwei Finger auf- oder zuziehen'], ['Zu einem Körper fliegen', 'Doppeltippen']] as Row[] },
        { device: 'Tastatur', rows: [['Um ihn herum drehen', 'W A S D oder Pfeiltasten'], ['Heran- / wegzoomen', 'R / F (oder + / -)']] as Row[] },
      ],
    },
    {
      title: 'Freier Flug',
      devices: [
        { device: 'Tastatur', rows: [['Vor / zurück', 'W / S oder ↑ / ↓'], ['Seitwärts', 'A / D oder ← / →'], ['Hoch / runter', 'R / F (oder Bild↑ / Bild↓)'], ['Rollen', 'Q / E'], ['Schub', 'Umschalttaste halten']] as Row[] },
        { device: 'Maus und Trackpad', rows: [['Umschauen', 'Ziehen'], ['Reisegeschwindigkeit', 'Scrollen']] as Row[] },
        { device: 'Touch', rows: [['Fliegen und seitwärts', 'Der Stick unten links'], ['Hoch, runter, Schub', 'Die Knöpfe rechts halten'], ['Umschauen', 'Irgendwo sonst ziehen'], ['Reisegeschwindigkeit', 'Zwei Finger auf- oder zuziehen']] as Row[] },
      ],
    },
    {
      title: 'Lektionen und Touren',
      devices: [
        {
          device: 'Alle',
          rows: [
            ['In einer Lektion umschauen', 'Ziehen (ein Stück weit), Zoom-Knöpfe rechts'],
            ['Zurück zur Ansicht der Lektion', 'Der Zurücksetzen-Knopf rechts'],
            ['Kapitel von selbst umblättern', 'Abspielen, in der Lektionsleiste'],
            ['Missions-Tour anhalten, springen, verlassen', 'Ihre Zeitleiste unten; Esc verlässt sie'],
          ] as Row[],
        },
      ],
    },
    {
      title: 'Überall',
      devices: [
        {
          device: 'Tastatur',
          rows: [
            ['Alles durchsuchen', 'Strg+K (⌘K auf dem Mac)'],
            ['Oberfläche aus- oder einblenden', 'H'],
            ['Panel oder Dialog schließen', 'Esc'],
            ['Kamera-Tour beenden', 'Beliebige Taste, Klick oder Scrollen in der Szene'],
          ] as Row[],
        },
      ],
    },
  ],
}
