import type { apollo11Tour as English } from '../en/apollo11Tour'

// Die Worte der Apollo-11-Tour (siehe en/apollo11Tour.ts).

export const apollo11Tour: typeof English = {
  title: 'Apollo 11: zum Mond und zurück, im echten Maßstab',
  meta: 'Vom Erdorbit bis zur Wasserung auf der echten Bahn · 13 Stationen · etwa 25 Minuten',
  stations: {
    earthOrbit: {
      title: 'Im Erdorbit',
      text:
        'Zwölf Minuten nach dem Start umkreisen Columbia, Eagle und die dritte Stufe die Erde in 190 Kilometern ' +
        'Höhe. Anderthalb Umläufe lang prüfen Crew und Houston jedes System. Alle 45 Minuten wird es Nacht.',
    },
    tli: {
      title: 'Aufbruch zum Mond',
      text:
        'Über dem Pazifik zündet die dritte Stufe noch einmal: die Translunar Injection. Sechs Minuten später ist ' +
        'Apollo 11 fast elf Kilometer pro Sekunde schnell – genug, um ohne Antrieb bis zum Mond zu fliegen.',
    },
    docking: {
      title: 'Umsetzen und Andocken',
      text:
        'Michael Collins trennt Columbia ab, dreht sie um und dockt Spitze an Spitze an Eagle an, die noch oben in ' +
        'der dritten Stufe sitzt. Dann zieht er die Mondfähre heraus. Die ausgebrannte Stufe bleibt zurück.',
    },
    coast: {
      title: 'Drei Tage Flug',
      text:
        'Drei Tage lang gleitet das Raumschiff dahin und dreht sich dabei langsam, damit die Sonne jede Seite ' +
        'gleichmäßig wärmt. Die Erde schrumpft, der Mond wächst – und je weiter sie kommen, desto langsamer ' +
        'werden sie, bis der Mond stärker zieht als die Erde.',
    },
    loi: {
      title: 'Hinter dem Mond',
      text:
        'Hinter dem Mond, ohne Funkkontakt zur Erde, bremst Columbia sechs Minuten lang mit dem Haupttriebwerk. ' +
        'Als sie wieder hervorkommt, ist sie im Mondorbit. Erst da erfährt Houston, dass es geklappt hat.',
    },
    undocking: {
      title: 'Der Adler hat Flügel',
      text:
        'Armstrong und Aldrin schweben hinüber in Eagle, klappen die Beine aus und koppeln ab. „The Eagle has ' +
        'wings.“ Collins sieht sie sich von Columbia aus an. Hinter dem Mond bremst Eagle auf eine Bahn, die bis ' +
        'auf fünfzehn Kilometer hinabreicht.',
    },
    landing: {
      title: 'Die Landung',
      text:
        'Der Motorabstieg. Programmalarme – 1202, 1201 –, der Computer ist überlastet, fliegt aber weiter. Unten ' +
        'ist der geplante Landeplatz ein Krater voller Felsbrocken; Armstrong übernimmt und fliegt weiter. Mit ' +
        'Treibstoff für Sekunden: „The Eagle has landed.“',
    },
    firstStep: {
      title: 'Der erste Schritt',
      text:
        'Sechseinhalb Stunden später steigt Armstrong die Leiter hinab. Um 2:56 Uhr Weltzeit am 21. Juli 1969 ' +
        'betritt er den Mond. Aldrin folgt zwanzig Minuten später.',
    },
    columbiaAlone: {
      title: 'Columbia allein',
      text:
        'Michael Collins kreist derweil allein um den Mond, alle zwei Stunden dahinter, ohne Verbindung zu ' +
        'irgendwem. Eagle am Boden findet er mit seinem Sextanten nie ganz.',
    },
    liftoff: {
      title: 'Start vom Mond',
      text:
        'Nach einundzwanzigeinhalb Stunden auf dem Mond zündet die Aufstiegsstufe. Die Abstiegsstufe bleibt als ' +
        'Startrampe zurück. Eine abgebrochene Sicherung hatten sie mit einem Filzstift hineingedrückt.',
    },
    rendezvous: {
      title: 'Rendezvous',
      text:
        'Eagle holt Columbia mit vier vorsichtigen Manövern ein, von unten und hinten kommend. Dreieinhalb ' +
        'Stunden nach dem Start docken die beiden wieder; Armstrong und Aldrin schweben mit den Proben zurück in ' +
        'Columbia.',
    },
    tei: {
      title: 'Der Heimweg',
      text:
        'Wieder hinter dem Mond zündet das Haupttriebwerk zweieinhalb Minuten lang: die Transearth Injection. ' +
        'Zweieinhalb Tage Heimflug – ein Fall auf die Erde zu, immer schneller.',
    },
    entry: {
      title: 'Wiedereintritt',
      text:
        'Eine Viertelstunde vor dem Eintritt trennt sich die Kapsel vom Versorgungsmodul. Mit elf Kilometern pro ' +
        'Sekunde trifft sie auf die Luft, Hitzeschild voran, eingehüllt in glühendes Plasma – und wassert im ' +
        'Pazifik.',
    },
  },
}
