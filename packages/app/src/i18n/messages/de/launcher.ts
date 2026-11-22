import type { Messages } from '../en'

export const launcher: Messages['lessons']['launcher'] = {
  title: 'Startturm und Crawler',
  note:
    'Startplattform, Turm und Crawler sind die Modelle aus Project Apollo – NASSP (GPL), gebaut von ' +
    'dessen Freiwilligen für den Raumflugsimulator Orbiter; die Saturn V darauf ist unsere. Zahlen aus ' +
    'der Saturn V News Reference der NASA (1968).',
  chapters: {
    whole: {
      title: 'Rakete und Turm',
      text:
        'Die Saturn V stand nie allein auf dem Boden. Vom Vehicle Assembly Building bis zum Start stand ' +
        'sie auf ihrer mobilen Startplattform: einem stählernen Unterbau, zwei Stockwerke hoch und rund ' +
        '2.000 Quadratmeter groß, mit einem 121 Meter hohen Turm daneben. Zusammen wogen sie rund ' +
        '4.800 Tonnen.',
    },
    tower: {
      title: 'Der Versorgungsturm',
      text:
        'Der Turm ist ein offenes Stahlgerüst mit 18 Arbeitsebenen, zwei schnellen Aufzügen und einem ' +
        'Kran obendrauf. In ihm liefen die Leitungen für Treibstoff, Druckgase, Strom, Wasser und Funk ' +
        'nach oben, die die Rakete bis in die letzten Sekunden versorgten.',
    },
    arms: {
      title: 'Neun Arme',
      text:
        'Neun Versorgungsarme reichten vom Turm zur Rakete und führten diese Leitungen in ihre Stufen: ' +
        'Treibstoff und flüssigen Sauerstoff, kalte Gase, Klimaluft und Kabel. Der Zugangsarm der ' +
        'Besatzung schwenkte fünf Minuten vor dem Start zurück, der Arm der ersten Stufe Sekunden vorher; ' +
        'die übrigen lösten sich, als die Rakete aufstieg.',
    },
    crewArm: {
      title: 'Der Weg hinein',
      text:
        'Weit oben führte der Zugangsarm der Besatzung zu einem kleinen weißen Raum an der Luke des ' +
        'Kommandomoduls. Durch ihn stiegen Armstrong, Collins und Aldrin am Morgen des 16. Juli 1969 ein. ' +
        'Fünf Minuten vor dem Start schwenkte der Arm zurück.',
    },
    holddown: {
      title: 'Festgehalten',
      text:
        'Vier Haltearme umfassten den Fuß der ersten Stufe. Die fünf Triebwerke brauchten Sekunden bis ' +
        'zum vollen Schub: Die Arme hielten die Saturn V nach der Zündung etwa 8,9 Sekunden fest, bis ' +
        'jedes Triebwerk lief, wie es sollte – erst dann ließen sie los.',
    },
    crawler: {
      title: 'Der Crawler',
      text:
        'Zur Startrampe fuhren Plattform, Turm und Rakete gemeinsam auf dem Crawler-Transporter, einem ' +
        'der größten Landfahrzeuge, die je gebaut wurden: rund 2.700 Tonnen auf vier Doppelketten. ' +
        'Beladen kroch er mit 1,6 Kilometern pro Stunde über 5,6 Kilometer und hielt seine Plattform dabei ' +
        'auf ein Sechstel Grad waagerecht. Apollo 11 machte die Fahrt am 20. Mai 1969.',
    },
    liftoff: {
      title: 'Der Start',
      text:
        'Am 16. Juli 1969 um 9:32 Uhr Ortszeit zündeten die fünf Triebwerke. Die Arme schwenkten zurück, ' +
        'die Haltearme ließen los, und Apollo 11 stieg am Turm vorbei auf, unterwegs zum Mond.',
    },
  },
  parts: {
    launcher: 'Mobile Startplattform',
    holddown: 'Haltearme',
    mast1: 'Heckversorgungsmasten',
    mast2: 'Heckversorgungsmasten',
    mast3: 'Heckversorgungsmasten',
    cover1: 'Mastabdeckungen',
    cover2: 'Mastabdeckungen',
    cover3: 'Mastabdeckungen',
    tower: 'Versorgungsturm',
    damperArm: 'Dämpferarm',
    crewArm: 'Zugangsarm der Besatzung',
    serviceArms: 'Versorgungsarme',
    intertankArm: 'S-IC-Zwischentankarm',
    rocket: 'Saturn V',
    person: 'Ein Mensch (1,8 m)',
    crawler: 'Crawler-Transporter',
  },
  marks: {
    deck: { label: 'Deck der Startplattform' },
    tower: { label: 'Turmspitze' },
  },
  captions: {
    rollout: 'Die Saturn V von Apollo 11 auf dem Crawler, unterwegs zur Startrampe, 20. Mai 1969.',
    liftoff: 'Apollo 11 hebt von Launch Complex 39A ab, 16. Juli 1969.',
  },
  facts: {
    tower: { label: 'Turm', value: '121 m über dem Deck' },
    weight: { label: 'Plattform und Turm', value: 'rund 4.800 t' },
    platforms: { label: 'Arbeitsebenen', value: '18' },
    elevators: { label: 'Aufzüge', value: 'zwei, 183 m pro Minute' },
    arms: { label: 'Versorgungsarme', value: '9' },
    holddown: { label: 'Gehalten nach der Zündung', value: 'etwa 8,9 s' },
    crawlerMass: { label: 'Crawler', value: 'rund 2.700 t' },
    crawlerSpeed: { label: 'Tempo, beladen', value: '1,6 km/h' },
    crawlerway: { label: 'Zur Rampe', value: '5,6 km' },
  },
}
