import type { Messages } from '../en'

export const apollo11: Messages['lessons']['apollo11'] = {
  title: 'Apollo 11: zum Mond und zurück',
  note:
    'Erde und Mond stehen im richtigen Größenverhältnis zueinander, aber fünfmal näher beieinander als in ' +
    'Wirklichkeit; die Umlaufbahnen sind viel höher gezeichnet, als sie waren, und der Mond steht still – in ' +
    'den drei Tagen des Hinflugs zog er in Wahrheit um etwa 40 Grad weiter. Zeiten aus NASAs „Apollo by the ' +
    'Numbers“ und dem Apollo 11 Mission Report.',
  chapters: {
    launch: {
      title: 'Der Start',
      text:
        'Um 9:32 Uhr Ortszeit am Morgen des 16. Juli 1969 hob die Saturn V Apollo 11 von Startkomplex 39A in ' +
        'Florida ab. Keine zwölf Minuten später schaltete ihre dritte Stufe in einer Umlaufbahn ab, rund 190 ' +
        'Kilometer über der Erde – mit Treibstoff für eine weitere Zündung.',
    },
    parking: {
      title: 'Anderthalb Runden',
      text:
        'Anderthalb Runden um die Erde lang – etwa zweieinhalb Stunden – prüften die Crew und die ' +
        'Flugleitung das Raumschiff, bevor es aufbrach. Eine Runde dauerte rund anderthalb Stunden.',
    },
    tli: {
      title: 'Kurs auf den Mond',
      text:
        'Über dem Pazifik zündete die dritte Stufe noch einmal, fast sechs Minuten lang, und brachte das ' +
        'Raumschiff auf 10,8 Kilometer pro Sekunde – beinahe schnell genug, um die Erde für immer zu ' +
        'verlassen. Gezielt wurde nicht auf den Mond, sondern auf die Stelle, an der er drei Tage später ' +
        'stehen würde.',
    },
    dock: {
      title: 'Umdrehen und Andocken',
      text:
        'Eagle reiste zusammengefaltet im Adapter unter Columbia. Keine halbe Stunde nach der Zündung trennte ' +
        'Michael Collins Columbia ab, drehte sie um, dockte mit ihrer Spitze am Dach von Eagle an und zog die ' +
        'Mondfähre heraus. Die ausgebrannte dritte Stufe wurde am Mond vorbei in eine Bahn um die Sonne ' +
        'geschickt.',
    },
    coast: {
      title: 'Die Acht',
      text:
        'Drei Tage lang flog Apollo 11 antriebslos und wurde dabei langsamer, weil die Erde es zurückhielt. ' +
        'Es war eine Bahn mit freier Rückkehr: Wäre das Triebwerk ausgefallen, hätte die Schwerkraft des ' +
        'Mondes das Raumschiff herumgeschwenkt und nach Hause geschickt – die Acht. Von vier geplanten ' +
        'Kurskorrekturen war nur eine nötig.',
    },
    loi: {
      title: 'Hinter dem Mond',
      text:
        'Apollo 11 erreichte den Mond auf seiner Rückseite, ohne Funkverbindung zur Erde. Dort zündete ' +
        'Columbias Triebwerk fast sechs Minuten lang gegen die Flugrichtung und bremste das Raumschiff in eine ' +
        'Umlaufbahn. Ob es geklappt hatte, erfuhr die Flugleitung erst, als es hinter dem Mond hervorkam.',
    },
    descent: {
      title: 'Eagle steigt ab',
      text:
        'Im dreizehnten Umlauf koppelte Eagle ab. Armstrong und Aldrin flogen die Fähre hinunter, Collins ' +
        'blieb in Columbia. Eine kurze Zündung auf der Rückseite senkte Eagle auf 15 Kilometer; von dort ' +
        'bremste das Triebwerk bis ganz hinunter. Alarme des Bordcomputers und ein Feld voller Felsbrocken ' +
        'machten die letzten Minuten spannend – Armstrong flog darüber hinweg und landete mit Treibstoff für ' +
        'weniger als eine Minute.',
    },
    surface: {
      title: 'Tranquility Base',
      text:
        'Eagle landete am 20. Juli im Meer der Ruhe. Sechseinhalb Stunden später betrat Neil Armstrong die ' +
        'Oberfläche, Buzz Aldrin zwanzig Minuten nach ihm; zweieinhalb Stunden verbrachten sie draußen. Über ' +
        'ihnen kreiste Collins allein, bei jeder Runde ohne Funkkontakt hinter dem Mond.',
    },
    ascent: {
      title: 'Zurück zu Columbia',
      text:
        'Nach einundzwanzigeinhalb Stunden auf dem Mond hob die Aufstiegsstufe ab und ließ die Abstiegsstufe zurück. ' +
        'Keine vier Stunden später holte sie Columbia ein; die beiden dockten an, Armstrong und Aldrin ' +
        'kletterten durch den Tunnel zurück, und die Aufstiegsstufe wurde abgestoßen.',
    },
    home: {
      title: 'Der Heimweg',
      text:
        'Wieder auf der Rückseite zündete Columbias Triebwerk zweieinhalb Minuten lang und brachte sie auf ' +
        'Kurs zur Erde. Der Heimweg dauerte zweieinhalb Tage; eine kleine Korrektur genügte.',
    },
    splashdown: {
      title: 'Die Wasserung',
      text:
        'Kurz vor der Ankunft wurde das Servicemodul abgestoßen. Die Kommandokapsel traf mit 11 Kilometern ' +
        'pro Sekunde auf die Atmosphäre, ihr Hitzeschild glühte; die Fallschirme öffneten sich, und am 24. ' +
        'Juli landete sie im Pazifik, 24 Kilometer vom Bergungsschiff USS Hornet entfernt. Die Mission hatte ' +
        'acht Tage, drei Stunden und achtzehn Minuten gedauert.',
    },
  },
  labels: {
    apollo11: 'Apollo 11',
    columbia: 'Columbia',
    eagle: 'Eagle',
    tranquilityBase: 'Tranquility Base',
    freeReturn: 'Freie Rückkehr',
    burns: { tli: 'Einschuss zum Mond', loi: 'Einschwenken in den Mondorbit', tei: 'Einschuss zur Erde' },
    missionTime: (time: string) => `Missionszeit ${time}`,
  },
  captions: {
    launch: 'Apollo 11 hebt von Startkomplex 39A ab, 16. Juli 1969.',
    orbit: 'Eagle im Mondorbit nach dem Abkoppeln, die Beine ausgeklappt, die Fühler nach unten – fotografiert von Michael Collins.',
    surface: 'Eagle im Meer der Ruhe, 20. Juli 1969; Buzz Aldrin packt die Experimente aus der Abstiegsstufe aus.',
    rendezvous: 'Die Aufstiegsstufe mit Armstrong und Aldrin an Bord kehrt zu Columbia zurück; dahinter die Erde.',
    splashdown: 'Columbia nach der Wasserung im Pazifik, 24. Juli 1969, die Crew im Floß daneben.',
  },
  facts: {
    liftoff: { label: 'Start', value: '16. Juli 1969, 13:32 UTC' },
    inOrbit: { label: 'In der Erdumlaufbahn nach', value: '11 min 49 s' },
    period: { label: 'Eine Runde', value: 'rund 88 Minuten' },
    tliBurn: { label: 'Zündung', value: '5 min 47 s' },
    tliSpeed: { label: 'Geschwindigkeit danach', value: '10,8 km/s' },
    coast: { label: 'Unterwegs', value: '73 Stunden' },
    correction: { label: 'Kurskorrektur', value: '6,4 m/s, nach 26 h 45 min' },
    loiBurn: { label: 'Bremszündung', value: '5 min 58 s' },
    loiBrake: { label: 'Abgebremst um', value: '889 m/s' },
    orbitHeight: { label: 'Umlaufbahn', value: 'rund 100 bis 120 km hoch' },
    descentTime: { label: 'Angetriebener Abstieg', value: '12 min 35 s' },
    landing: { label: 'Landung', value: '20. Juli 1969, 20:17 UTC' },
    firstStep: { label: 'Erster Schritt', value: '21. Juli 1969, 02:56 UTC' },
    onMoon: { label: 'Auf dem Mond', value: '21 h 36 min' },
    teiBurn: { label: 'Zündung zur Heimkehr', value: '2 min 31 s' },
    entrySpeed: { label: 'Eintritt in die Atmosphäre', value: '11,0 km/s' },
    duration: { label: 'Mission', value: '195 h 18 min 35 s' },
  },
}
