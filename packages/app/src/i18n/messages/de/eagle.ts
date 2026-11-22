import type { Messages } from '../en'

export const eagle: Messages['lessons']['eagle'] = {
  title: 'Eagle, die Mondfähre',
  note:
    'Außenseite und Cockpit von Eagle sind die Modelle der Mondfähre aus Project Apollo – NASSP (GPL), ' +
    'gebaut von dessen Freiwilligen für den Raumflugsimulator Orbiter; Tanks und Triebwerke im ' +
    'Schnitt sind unsere, vereinfacht nach den veröffentlichten Maßen.',
  chapters: {
    whole: {
      title: 'Eagle',
      text:
        'Sieben Meter hoch und über neun Meter breit über die Füße: Die Mondfähre war das erste bemannte ' +
        'Raumfahrzeug, das nur für den luftleeren Raum gebaut wurde. Sie musste nie durch eine Atmosphäre, ' +
        'brauchte also keine Stromlinienform – nur leicht musste sie sein. Ihre Wände sind stellenweise ' +
        'kaum dicker als ein paar Blatt Papier.',
    },
    folded: {
      title: 'Zusammengefaltet für die Reise',
      text:
        'Auf dem Weg zum Mond reiste Eagle zusammengefaltet unter dem Raumschiff, im Adapter auf der ' +
        'dritten Stufe der Saturn V. Die vier Beine waren an die Seiten hochgeklappt. Erst im Mondorbit, ' +
        'vor dem Abstieg, klappten sie aus und rasteten ein.',
    },
    stages: {
      title: 'Zwei Fahrzeuge in einem',
      text:
        'Eagle sind zwei übereinander gesetzte Raumfahrzeuge: Die Abstiegsstufe unten, mit Triebwerk, ' +
        'Treibstoff und Landebeinen, brachte beide Astronauten hinunter. Die Aufstiegsstufe oben, mit der ' +
        'Kabine und einem eigenen Triebwerk, brachte sie zurück zu Columbia.',
    },
    descent: {
      title: 'Die Abstiegsstufe, aufgeschnitten',
      text:
        'Vier Tanks umgeben das Abstiegstriebwerk, zwei mit Treibstoff, zwei mit Oxidator. Es war das ' +
        'erste Triebwerk eines bemannten Raumfahrzeugs, das sich drosseln ließ: von vollem Schub bis auf ein Zehntel. So konnte Neil ' +
        'Armstrong schweben und über die Felsbrocken hinwegfliegen, bis er einen Landeplatz fand.',
    },
    ascent: {
      title: 'Die Aufstiegsstufe',
      text:
        'Die Kabine der Besatzung, links und rechts je ein Tank und darunter ein Triebwerk – ohne Drossel und ' +
        'ohne Schwenklager, so einfach wie ein Triebwerk nur sein kann, denn es musste funktionieren. ' +
        'Sechzehn kleine Düsen in vier Gruppen an den Ecken steuerten die Fähre.',
    },
    inside: {
      title: 'Innen',
      text:
        'Hinein geht es durch die quadratische Luke vorn, auf Händen und Knien. Drinnen gibt es keine ' +
        'Sitze: Armstrong und Aldrin standen, an der Hüfte von Seilen gehalten, jeder an seinem eigenen ' +
        'dreieckigen Fenster. Stehen sparte Gewicht und brachte die Augen nah an die Fenster.',
    },
    panels: {
      title: 'Instrumente und Fenster',
      text:
        'Vor jedem von ihnen die Fluganzeigen: die Lagekugel, das Fadenkreuz, Höhe und Sinkrate. ' +
        'Dazwischen die Tastatur des Bordcomputers – des Computers, dessen Alarme 1202 bei der Landung ' +
        'ertönten. Die Fenster blicken nach unten und vorn, auf den Boden, dem sie entgegenflogen.',
    },
    liftoff: {
      title: 'Start vom Mond',
      text:
        'Nach 21 Stunden auf der Oberfläche zündete die Aufstiegsstufe und hob von der Abstiegsstufe ab, ' +
        'die ihr als Startrampe diente. Die Abstiegsstufe steht bis heute im Meer der Ruhe, mit der ' +
        'Plakette an ihrem Bein.',
    },
  },
  parts: {
    descent: 'Abstiegsstufe',
    descentInside: 'Tanks und Abstiegstriebwerk',
    leg0: 'Landebein',
    leg1: 'Landebein',
    leg2: 'Landebein',
    leg3: 'Landebein',
    link0: 'Streben',
    link1: 'Streben',
    link2: 'Streben',
    link3: 'Streben',
    ascent: 'Aufstiegsstufe',
    ascentInside: 'Tanks und Aufstiegstriebwerk',
    cockpit: 'Kabine',
    panels: 'Fluganzeigen',
    dsky: 'Tastatur des Bordcomputers',
    windows: 'Fenster',
    person: 'Ein Mensch (1,8 m)',
  },
  marks: {
    descent: { label: 'Oberkante der Abstiegsstufe' },
    ascent: { label: 'Oberkante der Aufstiegsstufe' },
  },
  captions: {
    surface: 'Eagle im Meer der Ruhe, 20. Juli 1969; Buzz Aldrin packt die Experimente aus der Abstiegsstufe aus.',
    orbit: 'Eagle im Mondorbit nach dem Abkoppeln, die Beine ausgeklappt, die Fühler nach unten – fotografiert von Michael Collins.',
    hatch: 'Buzz Aldrin kriecht rückwärts aus der Luke auf die Plattform, die Füße voran, bevor er die Leiter hinabsteigt.',
    rendezvous: 'Die Aufstiegsstufe mit Armstrong und Aldrin an Bord kehrt zu Columbia zurück; dahinter die Erde.',
  },
  facts: {
    height: { label: 'Höhe', value: 'etwa 7 m' },
    width: { label: 'Über die Beine', value: 'etwa 9,4 m' },
    mass: { label: 'Masse, betankt', value: 'etwa 15 t' },
    descentEngine: { label: 'Abstiegstriebwerk', value: '44 kN, drosselbar auf ein Zehntel' },
    ascentEngine: { label: 'Aufstiegstriebwerk', value: '15,6 kN' },
    room: { label: 'Wohnraum', value: 'etwa 4,5 m³' },
  },
}
