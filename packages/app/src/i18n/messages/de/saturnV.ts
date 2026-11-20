import type { Messages } from '../en'

export const saturnV: Messages['lessons']['saturnV'] = {
  title: 'Die Saturn V, auseinandergenommen',
  note:
    'Das Modell ist aus den veröffentlichten Maßen der Rakete gebaut und maßstabsgetreu; das Innere ' +
    'ist schematisch. Wo die Dokumente ein Maß offenlassen (Adapter, Rettungsturm, Flossen), ist es ' +
    'eine gute Näherung.',
  chapters: {
    whole: {
      title: 'Die ganze Rakete',
      text:
        'Am 16. Juli 1969 trug diese Rakete Apollo 11 auf den Weg zum Mond. Die Saturn V war 110,6 m ' +
        'hoch – höher als die Freiheitsstatue samt Sockel – und wog beim Start 2.938 t, fast alles davon ' +
        'Treibstoff. Die kleine orange Figur an ihrem Fuß ist ein Mensch, im selben Maßstab.',
    },
    stack: {
      title: 'Der Stapel',
      text:
        'Die Saturn V sind drei aufeinandergesetzte Raketen mit einem Raumschiff obendrauf. Jede Stufe ' +
        'brennt, bis ihre Tanks leer sind, und wird dann abgeworfen, damit die nächste weniger tragen ' +
        'muss: S-IC, S-II und S-IVB. Darüber sitzen die Instrument Unit, der Adapter mit der Mondfähre, ' +
        'Versorgungs- und Kommandomodul und der Rettungsturm. Der Name der S-IVB erzählt ihre Herkunft: ' +
        'Sie ist eine verbesserte S-IV, die zuvor die zweite Stufe der kleineren Saturn I war.',
    },
    sic: {
      title: 'S-IC: Fünf F-1-Triebwerke',
      text:
        'Die erste Stufe hebt die ganze Rakete von der Rampe. Ihre fünf F-1 verbrennen Kerosin (RP-1) ' +
        'mit flüssigem Sauerstoff und schieben zusammen mit etwa 34 Meganewton. Jede Sekunde schlucken ' +
        'sie fast 13 t Treibstoff; der Sauerstoff fließt aus dem oberen Tank durch fünf Rohre mitten ' +
        'durch den Kerosintank darunter. Das mittlere Triebwerk schaltet nach 2 Minuten 15 Sekunden ab, ' +
        'die äußeren vier nach 2 Minuten 42 Sekunden; in 67 km Höhe fällt die leere Stufe ab.',
    },
    sii: {
      title: 'S-II: Wasserstoff',
      text:
        'Die zweite Stufe verbrennt flüssigen Wasserstoff, −253 °C kalt, mit flüssigem Sauerstoff. ' +
        'Wasserstoff liefert mehr Schub pro Kilogramm, ist aber so leicht, dass er einen riesigen Tank ' +
        'braucht. Um Länge und Gewicht zu sparen, teilen sich Wasserstoff- und Sauerstofftank eine Wand – ' +
        'einen isolierten Zwischenboden, damit der Sauerstoff am kälteren Wasserstoff nicht gefriert. ' +
        'Ihre fünf J-2 brennen 6 Minuten 25 Sekunden.',
    },
    sivb: {
      title: 'S-IVB: Zweimal gezündet',
      text:
        'Die dritte Stufe hat ein einziges J-2, und das lässt sich neu zünden. Die erste Zündung, 2 Minuten ' +
        '27 Sekunden, bringt Apollo in eine Parkbahn um die Erde. Im zweiten Umlauf – die Crew ' +
        'hat inzwischen ihr Raumschiff geprüft – brennt es noch einmal 5 Minuten 47 Sekunden: der ' +
        'Einschuss zum Mond (TLI), der Apollo 11 mit rund 39.000 km/h auf den Weg schickt.',
    },
    iu: {
      title: 'Die Instrument Unit',
      text:
        'Ein Ring, nur 91 cm hoch und 6,6 m breit, ist das Gehirn der Rakete. Darin stecken ein ' +
        'Steuercomputer, eine Kreiselplattform, die immer weiß, wo oben ist, und Funkgeräte. Sie lenkt ' +
        'die Triebwerke, löst jede Stufentrennung aus und steuert die S-IVB, bis das Raumschiff sie verlässt.',
    },
    spacecraft: {
      title: 'Das Raumschiff obendrauf',
      text:
        'Unter dem kegelförmigen Adapter wartet die Mondfähre mit eingeklappten Beinen. Darüber sitzen ' +
        'das Versorgungsmodul mit Haupttriebwerk, Treibstoff, Sauerstoff und Strom und das Kommandomodul, ' +
        'in dem die drei Astronauten wohnen. Der Turm an der Spitze hätte das Kommandomodul von einer ' +
        'versagenden Rakete wegziehen können; er wurde abgeworfen, während die zweite Stufe brannte.',
    },
    returns: {
      title: 'Was zurückkommt',
      text:
        'Vom ganzen Stapel kehrt nur das Kommandomodul heim: eine Kapsel von 4,9 t, die am 24. Juli ' +
        '1969 im Pazifik wasserte. Alles andere wurde unterwegs abgeworfen – die Stufen nacheinander, der ' +
        'Turm, der Adapter; die Mondfähre blieb am Mond zurück.',
    },
  },
  parts: {
    les: 'Rettungsturm',
    cm: 'Kommandomodul',
    sm: 'Versorgungsmodul',
    sla: 'Adapter (SLA)',
    lm: 'Mondfähre',
    iu: 'Instrument Unit',
    sivb: 'S-IVB',
    sivbInside: 'Wasserstoff und Sauerstoff',
    sivbEngine: 'J-2',
    sii: 'S-II',
    siiInside: 'Wasserstoff über Sauerstoff',
    siiEngines: '5 × J-2',
    sic: 'S-IC',
    sicInside: 'Sauerstoff über Kerosin',
    sicEngines: '5 × F-1',
    person: 'Ein Mensch (1,8 m)',
  },
  marks: {
    sic: { label: 'Oberkante S-IC', note: 'erste Stufe' },
    sii: { label: 'Oberkante S-II', note: 'zweite Stufe' },
    sivb: { label: 'Oberkante S-IVB', note: 'dritte Stufe, eine verbesserte S-IV' },
    top: { label: 'Spitze des Rettungsturms' },
  },
  facts: {
    height: { label: 'Höhe', value: '110,6 m' },
    mass: { label: 'Masse beim Start', value: '2.938 t' },
    diameter: { label: 'Durchmesser', value: '10,1 m' },
    thrust: { label: 'Schub beim Start', value: 'etwa 34 MN' },
    sicBurn: { label: 'Brenndauer', value: '2 min 42 s' },
    flow: { label: 'Treibstoff pro Sekunde', value: 'fast 13 t' },
    hydrogen: { label: 'Flüssiger Wasserstoff', value: '−253 °C' },
    siiBurn: { label: 'Brenndauer', value: '6 min 25 s' },
    siiPropellant: { label: 'Treibstoff', value: '427 t' },
    tli: { label: 'Einschuss zum Mond', value: '5 min 47 s' },
    tliSpeed: { label: 'Danach', value: 'rund 39.000 km/h' },
    iuHeight: { label: 'Höhe', value: '91 cm' },
    capsule: { label: 'Kommandomodul bei der Landung', value: '4,9 t' },
  },
  captions: {
    launch: 'Apollo 11 hebt von Startkomplex 39A ab, 16. Juli 1969.',
    rollout: 'Die Saturn V von Apollo 11 auf dem Weg zur Rampe, 20. Mai 1969.',
    f1: 'Ein F-1-Triebwerk: 5,8 m hoch, der Techniker daneben wirkt winzig.',
    sii: 'Eine S-II wird im Vehicle Assembly Building auf die S-IC gesetzt (Apollo 6).',
    sivb: 'Eine S-IVB auf ihrem Prüfstand in Kalifornien (Apollo 10).',
    iu: 'NASA-Übersicht der Instrument Unit und ihrer Systeme.',
  },
}
