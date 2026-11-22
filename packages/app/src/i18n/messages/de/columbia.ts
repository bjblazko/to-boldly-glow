import type { Messages } from '../en'

export const columbia: Messages['lessons']['columbia'] = {
  title: 'Columbia, von außen und innen',
  note:
    'Die Außenseite ist aus den veröffentlichten Maßen gebaut; das Innere des Versorgungsmoduls ist ' +
    'schematisch. Die Kabine im Flug ist das Modell von Project Apollo – NASSP, Schalter für Schalter; ' +
    'die Kabine heute ist der 3D-Scan der echten Columbia durch die Smithsonian im National Air and Space Museum.',
  chapters: {
    whole: {
      title: 'Das Raumschiff',
      text:
        'Das Raumschiff von Apollo 11 bestand aus zwei Teilen: dem Kommandomodul Columbia, in dem die drei ' +
        'Astronauten lebten, und dem Versorgungsmodul dahinter mit Haupttriebwerk, Treibstoff, Sauerstoff ' +
        'und Strom. Gemeinsam flogen sie zum Mond und zurück; nur das Kommandomodul kehrte zur Erde heim.',
    },
    serviceModule: {
      title: 'Das Versorgungsmodul, aufgeschnitten',
      text:
        'Sechs keilförmige Sektoren umgeben das Haupttriebwerk. Zwei enthalten den Oxidator, zwei den ' +
        'Brennstoff, jeweils in einem Sammel- und einem Vorratstank; Helium in der Mitte drückt die ' +
        'Treibstoffe zum Triebwerk. Ein Sektor enthält drei Brennstoffzellen und die Sauerstoff- und ' +
        'Wasserstofftanks, aus denen sie Strom machen. Etwa drei Viertel des Gewichts sind Treibstoff.',
    },
    engine: {
      title: 'Das Triebwerk, das funktionieren musste',
      text:
        'Das Haupttriebwerk schiebt mit etwa 89 Kilonewton und lässt sich neu zünden. Es bremste Apollo 11 ' +
        'in eine Umlaufbahn um den Mond und schickte Columbia nach der Landung nach Hause. Ein zweites ' +
        'Triebwerk als Reserve gab es nicht.',
    },
    commandModule: {
      title: 'Das Kommandomodul',
      text:
        'Ein Kegel, 3,2 m hoch und 3,9 m breit. Unter der Haut liegt der Hitzeschild: Stahlwaben mit einem ' +
        'Phenol-Epoxidharz darüber, das verkohlte und abfiel, als die Kapsel durch die Atmosphäre ' +
        'zurückkehrte. Fünf Fenster, eine Seitenluke und oben der Tunnel zur Mondfähre.',
    },
    inside: {
      title: 'Innen',
      text:
        'So sah die Kabine im Flug aus, Schalter für Schalter nachgebaut von Project Apollo – NASSP. Sie bot ' +
        'etwa 6 Kubikmeter Platz – für drei Männer und acht Tage, den ganzen Weg zum Mond und zurück.',
    },
    panels: {
      title: 'Die Hauptinstrumententafel',
      text:
        'Über den Liegen wölbt sich die Hauptinstrumententafel: Schalter, Anzeigen und Warnlampen für jedes ' +
        'System an Bord und die Tastatur des Steuercomputers. Links saß der Kommandant, in der Mitte der ' +
        'Pilot des Kommandomoduls, rechts der Pilot der Mondfähre.',
    },
    seats: {
      title: 'Drei Liegen',
      text:
        'Die drei Liegen stehen auf zusammendrückbaren Wabenstreben, die den Aufprall auf dem Wasser ' +
        'abfederten. An ihrem Fußende liegt die untere Geräteabteilung mit den Navigationsinstrumenten: ' +
        'Sextant, Teleskop und der Steuercomputer mit seiner Tastatur.',
    },
    today: {
      title: 'Columbia heute',
      text:
        'Die echte Columbia steht im National Air and Space Museum in Washington. Die Smithsonian hat ihre ' +
        'Kabine gescannt und rundum fotografiert: Das ist dieser Scan, die Kabine, wie sie heute ist – die ' +
        'Liegen abgewetzt, die Farben verblasst, so wie die Kapsel heimkehrte.',
    },
    notes: {
      title: 'Notizen an den Wänden',
      text:
        'Handgeschriebene Zahlen und Notizen bedecken Teile der Wände. Michael Collins flog Columbia allein ' +
        'um den Mond, während Armstrong und Aldrin auf seiner Oberfläche liefen. Der Scan bewahrt jede ' +
        'Zeile, so wie die Kapsel heimkehrte.',
    },
  },
  parts: {
    cm: 'Kommandomodul',
    sm: 'Versorgungsmodul',
    smInside: 'Tanks und Brennstoffzellen',
    sps: 'Haupttriebwerk',
    rcs: 'Steuerdüsen',
    antenna: 'Richtantenne',
    person: 'Ein Mensch (1,8 m)',
    hull: 'Kabinenwand',
    panels: 'Hauptinstrumententafel',
    seats: 'Liegen',
    notes: 'Notizen der Crew',
    vcCabin: 'Kabinenwand',
    vcPanels: 'Hauptinstrumententafel',
    vcHatches: 'Luken',
    vcCouches: 'Liegen',
  },
  marks: {
    sm: { label: 'Oberkante Versorgungsmodul' },
    cm: { label: 'Oberkante Kommandomodul' },
  },
  captions: {
    splashdown: 'Columbia nach der Wasserung im Pazifik, 24. Juli 1969, die Crew im Floß daneben.',
    hornet: 'Columbia an Bord der USS Hornet, der Hitzeschild vom Wiedereintritt verkohlt; daneben der Quarantäne-Container.',
    simulator: 'Michael Collins beim Training im Simulator des Kommandomoduls, Juni 1969.',
  },
  facts: {
    cmHeight: { label: 'Kommandomodul', value: '3,2 m hoch' },
    diameter: { label: 'Durchmesser', value: '3,9 m' },
    smMass: { label: 'Versorgungsmodul, betankt', value: 'etwa 25 t' },
    propellant: { label: 'Anteil Treibstoff', value: 'etwa 75 %' },
    thrust: { label: 'Haupttriebwerk', value: 'etwa 89 kN' },
    room: { label: 'Platz innen', value: 'etwa 6 m³' },
    crew: { label: 'Besatzung', value: '3' },
  },
}
