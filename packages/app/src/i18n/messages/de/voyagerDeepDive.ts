import type { Messages } from '../en'

export const voyagerDeepDive: Messages['lessons']['voyagerDeepDive'] = {
  title: 'Voyager im Detail',
  note:
    'Die Explosionsansicht zieht die Teile auseinander, damit man sie sieht – im All sind sie ein ' +
    'Raumfahrzeug. Die Route ist echt (JPL Horizons), aber im Kompakt-Maßstab gezeichnet: Entfernungen ' +
    'gestaucht, Planeten um ein Vielfaches größer. Die Diagramme zeigen echte Messdaten.',
  chapters: {
    'taken-apart': {
      title: 'Auseinandergenommen',
      text:
        'Der Rumpf von Voyager ist ein zehneckiger Ring aus Elektronikkästen, 1,8 m breit, um einen Tank ' +
        'mit Treibstoff für die kleinen Steuerdüsen. Darauf sitzen die 3,7-m-Antenne, zwei Ausleger – einer ' +
        'für die Stromversorgung, einer für die Instrumentenplattform – und der Magnetometer-Ausleger: 13 m ' +
        'dünne Glasfaserstäbe, die für den Start in einem Behälter zusammengefaltet waren. Die Goldene ' +
        'Schallplatte ist außen am Rumpf befestigt.',
    },
    power: {
      title: 'Strom aus Plutonium',
      text:
        'Drei Radionuklidbatterien (RTGs) machen aus der Wärme von zerfallendem Plutonium-238 Strom – ganz ' +
        'ohne Sonnenlicht. Beim Start lieferten sie etwa 470 Watt. Weil das Plutonium zerfällt und die ' +
        'Thermoelemente altern, sinkt die Leistung um etwa 4 Watt pro Jahr. Deshalb schaltet das Team ' +
        'Heizungen und Instrumente nach und nach ab, damit der Rest weiterläuft.',
    },
    communication: {
      title: 'Ein Flüstern quer durchs Sonnensystem',
      text:
        'Voyager funkt mit einem Sender von etwa 23 Watt – so viel wie eine Kühlschranklampe – über ihre ' +
        '3,7-m-Antenne. Wenn das Signal ankommt, ist es so schwach, dass nur die 70-Meter-Antennen des Deep ' +
        'Space Network der NASA in Kalifornien, Spanien und Australien es empfangen können. Die Daten ' +
        'tröpfeln mit 160 Bit pro Sekunde herein. Voyager 2, weit südlich der Planetenebene, ist nur noch ' +
        'von Australien aus erreichbar.',
    },
    instruments: {
      title: 'Elf Instrumente',
      text:
        'Jede Voyager trägt elf wissenschaftliche Instrumente. Auf der schwenkbaren Plattform am Ende des ' +
        'Instrumentenauslegers: eine Weitwinkel- und eine Telekamera, Spektrometer für Infrarot- und ' +
        'Ultraviolettlicht und ein Photopolarimeter, die gemeinsam auf ein Ziel gedreht werden. Am Rumpf ' +
        'und an den Auslegern: Instrumente für Plasma, geladene Teilchen und kosmische Strahlung, ' +
        'Magnetometer und zwei 10 m lange Drahtantennen, die Radio- und Plasmawellen belauschen; die ' +
        'Funkverbindung selbst ist das elfte. Im interstellaren Raum zählen nur noch Felder und Teilchen – ' +
        'und nur wenige Instrumente sind noch eingeschaltet.',
    },
    'gravity-assist': {
      title: 'Schwung holen an Planeten',
      text:
        'Das Diagramm zeigt die echte Geschwindigkeit von Voyager 2 um die Sonne, aus ihrer JPL-Flugbahn, ' +
        'und die Geschwindigkeit, die sie an ihrem Ort bräuchte, um der Sonne zu entkommen. Beim Abflug von ' +
        'der Erde war sie zu langsam – allein wäre sie zurückgefallen. Jupiter, Saturn und Uranus gaben ihr ' +
        'jeweils etwas von ihrer eigenen Bewegung um die Sonne ab: Nach Jupiter war sie schon schnell genug, ' +
        'um das Sonnensystem für immer zu verlassen. Neptun, der ihre Bahn nach Süden bog, bremste sie etwas.',
    },
    'out-of-plane': {
      title: 'Raus aus der Ebene',
      text:
        'Von der Seite gesehen kreisen alle Planeten fast in einer Ebene. Der nahe Vorbeiflug an Titan 1980 ' +
        'schleuderte Voyager 1 nach Norden aus dieser Ebene, um etwa 35 Grad. Der Flug über Neptuns Nordpol ' +
        '1989 schickte Voyager 2 nach Süden, unter die Ebene. Die beiden fliegen heute in sehr verschiedene ' +
        'Richtungen.',
    },
    heliopause: {
      title: 'Durch die Heliopause',
      text:
        'Die eigenen Messwerte von Voyager 1, Tag für Tag im Jahr 2012. Innerhalb weniger Tage um den ' +
        '25. August verschwanden die Teilchen, die die Blase des Sonnenwinds füllen, fast völlig – Protonen ' +
        'mit 3 bis 4,6 MeV wurden etwa hundertmal seltener –, und das Magnetfeld wurde stärker und ' +
        'gleichmäßiger. Voyager 1 hatte die Heliosphäre verlassen. Plasmawellen, gemessen 2013, bestätigten ' +
        'es: Das Gas um sie herum war etwa 40-mal dichter als in der Blase.',
    },
    'reading-cover': {
      title: 'Die Hülle lesen',
      text:
        'Oben links: die Platte von oben mit ihrer Nadel und binär die Zeit für eine Umdrehung – 3,6 ' +
        'Sekunden, gezählt in Wasserstoff-Zeit. Darunter: die Platte von der Seite – von außen nach innen ' +
        'abspielen, etwa eine Stunde pro Seite. Oben rechts: wie ein Bild gespeichert ist – das Signal einer ' +
        'Bildzeile, die Zeilen untereinander gezeichnet, und das erste Bild, ein Kreis, zur Kontrolle. Unten ' +
        'links: die Pulsarkarte. Jede Linie zeigt auf einen Pulsar, ihr Binärcode sagt, wie schnell er ' +
        'blinkt, und die lange Linie führt zum Zentrum der Galaxis. Pulsare werden mit der Zeit langsamer – ' +
        'die Karte verrät also, wo und wann. Unten rechts: Wasserstoff, die Uhr für alle Zahlen. Ein kleiner ' +
        'Fleck aus hochreinem Uran-238 auf der Hülle ist eine zweite Uhr: Sein Zerfall verrät, wie lange die ' +
        'Platte schon unterwegs ist.',
    },
    'picture-in-sound': {
      title: 'Ein Bild in einem Ton',
      text:
        'Wie kommen Bilder auf eine Schallplatte? Als Ton: Jedes Bild wird Zeile für Zeile gelesen, wie ' +
        'bei einem alten Fernsehsignal. Jede Zeile beginnt mit einem kurzen Puls, der unter Schwarz ' +
        'abtaucht – das Zeichen „hier beginnt eine Zeile“ –, danach folgt die Helligkeit entlang der Zeile ' +
        'als Höhe des Signals. Beim Abspielen werden die Zeilen untereinander gezeichnet, und das Bild ' +
        'erscheint. Genau das zeigt die Hülle oben rechts, mit dem ersten Bild als Test: einem Kreis. Unten ' +
        'durchläuft ein eigenes Bild dieselben Schritte. Die Platte selbst dreht sich mit 16⅔ Umdrehungen ' +
        'pro Minute, halb so schnell wie eine LP.',
    },
    'still-talking': {
      title: 'Sie funken noch',
      text:
        'Fast ein halbes Jahrhundert nach dem Start schicken beide Voyagers noch Daten nach Hause. Um Strom ' +
        'zu sparen, hat das Team die meisten Instrumente abgeschaltet; einige, die Felder und Teilchen ' +
        'messen, laufen noch. Irgendwann in den 2030er-Jahren reicht der Strom nicht mehr für die Sender, und ' +
        'die beiden Sonden verstummen – aber sie fliegen noch Milliarden Jahre um die Galaxis, jede mit ' +
        'ihrer Goldenen Schallplatte.',
    },
  },
}
