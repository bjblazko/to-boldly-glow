import type { Messages } from '../en'

export const lessons: Messages['lessons'] = {
  topics: {
    planets: 'Planeten & Größen',
    earthAndMoon: 'Erde & Mond',
    skyEvents: 'Himmelsereignisse',
  },
  seasons: {
    title: 'Warum hat die Erde Jahreszeiten?',
    note:
      'Nicht maßstäblich: Sonne und Erde sind viel größer und näher beieinander gezeichnet, als sie wirklich ' +
      'sind, und die Erde dreht sich und kreist viel schneller als in echt. Alle gezeigten Winkel stimmen.',
    chapters: {
      orbit: {
        title: 'Die echte Bahn: die Erde um die Sonne',
        text:
          'Sieh zu, wie die Erde wirklich um die Sonne kreist. Ihre Achse zeigt dabei immer in dieselbe feste ' +
          'Richtung im Raum – sie kippt nie zur Sonne hin und richtet sich nie zu ihr auf. Aber weil sich die ' +
          'Position der Erde ständig ändert, ändert sich auch der Winkel zwischen dieser festen Achse und der ' +
          'Sonne: mal neigt sie sich zur Sonne hin, mal von ihr weg, und zweimal pro Runde steht sie genau ' +
          'seitlich. Dieser wechselnde Winkel – nicht eine Bewegung der Achse selbst – ist der wahre Grund für ' +
          'die Jahreszeiten. Die Zahl zeigt, wie viel der 23,4° Neigung gerade zur Sonne hin oder von ihr weg ' +
          'zeigt. (Einmal pro Runde verschwindet die Erde aus diesem Blickwinkel kurz hinter der Sonne – das ' +
          'liegt nur an der Kameraposition, im All passiert dabei nichts Besonderes.)',
      },
      intro: {
        title: 'Einführung: eine schiefe Welt',
        text:
          'Die Erdachse ist das ganze Jahr über um 23,4° gegen ihre Bahn um die Sonne geneigt. Diese Neigung – ' +
          'nicht der Abstand zur Sonne, der sich im Lauf eines Jahres kaum ändert – sorgt für die ' +
          'Jahreszeiten: Was sich ändert, ist, wohin die Neigung relativ zur Sonne zeigt. Achte auf Ort A ' +
          '(Norden) und Ort B (Süden), während du durch die Kapitel gehst.',
      },
      'march-equinox': {
        title: 'Frühlings-Tagundnachtgleiche',
        text:
          'Um die Tagundnachtgleiche im März ist die Erdachse immer noch um 23,4° geneigt, aber zur Seite: ' +
          'weder zur Sonne hin noch von ihr weg (aus diesem Blickwinkel neigt sie sich von dir weg). Die ' +
          'Sonne steht also genau über dem Äquator, und Ort A und Ort B haben fast gleich lange Tage und Nächte.',
      },
      'june-solstice': {
        title: 'Sommersonnenwende im Juni',
        text:
          'Die Sonnenwende im Juni: Der Nordpol neigt sich zur Sonne. Ort A (Norden) bekommt längere Tage ' +
          'und steiler einfallendes Sonnenlicht – Sommer. Ort B (Süden) bekommt kürzere Tage und flacheres ' +
          'Sonnenlicht – Winter.',
      },
      'september-equinox': {
        title: 'Herbst-Tagundnachtgleiche',
        text:
          'Um die Tagundnachtgleiche im September zeigt die Neigung wieder zur Seite – diesmal zu dir hin. Die ' +
          'Sonne steht wieder über dem Äquator, und Ort A und Ort B haben wieder fast gleich lange Tage und ' +
          'Nächte – nur geht der Trend jetzt umgekehrt wie im März.',
      },
      'december-solstice': {
        title: 'Wintersonnenwende im Dezember',
        text:
          'Die Sonnenwende im Dezember: Der Südpol neigt sich zur Sonne. Ort B (Süden) bekommt längere Tage ' +
          'und steiler einfallendes Sonnenlicht – Sommer. Ort A (Norden) bekommt kürzere Tage und flacheres ' +
          'Sonnenlicht – Winter.',
      },
    },
  },
  moonPhases: {
    title: 'Warum hat der Mond Phasen?',
    note: (skyEnlargement, tiltExaggeration) =>
      'Nicht maßstäblich: Der Mond ist viel näher an der Erde gezeichnet, als er ist, umrundet sie in Sekunden ' +
      `statt in einem Monat und sieht vom Boden aus etwa ${skyEnlargement}-mal größer aus als am Himmel. ` +
      `In der Seitenansicht ist seine Bahn etwa ${tiltExaggeration}-mal steiler geneigt als die echten 5°. ` +
      'Naturgetreu: welcher Teil des Mondes von der Sonne beleuchtet wird, und damit seine Form von der Erde aus.',
    chapters: {
      'always-half-lit': {
        title: 'Immer zur Hälfte beleuchtet',
        text:
          'Die Sonne beleuchtet immer genau die Hälfte des Mondes – die ihr zugewandte, so wie sie auch die ' +
          'halbe Erde beleuchtet. Was sich über einen Monat ändert, ist, wie viel dieser hellen Hälfte uns ' +
          'zugewandt ist. Bei Neumond zeigt sie von uns weg, bei Vollmond zu uns, beim ersten und letzten ' +
          'Viertel sehen wir die Hälfte davon. Die Karte in der Ecke zeigt den Mond, wie man ihn gerade von ' +
          'der Erde aus sieht.',
      },
      'not-earths-shadow': {
        title: 'Nicht der Erdschatten',
        text:
          'Eine häufige Verwechslung: Die Phasen sind nicht der Schatten der Erde auf dem Mond. Der Erdschatten ' +
          'zeigt genau von der Sonne weg, der Mond könnte also nur bei Vollmond hineingeraten – genau dann, ' +
          'wenn wir ihn voll beleuchtet sehen. Und weil die Mondbahn geneigt ist, zieht der Vollmond fast ' +
          'immer ein wenig über oder unter dem Schatten vorbei. Geht er doch hindurch, ist das eine ' +
          'Mondfinsternis – ein seltenes Ereignis, nicht die monatlichen Phasen.',
      },
      'same-face': {
        title: 'Immer dasselbe Gesicht',
        text:
          'Der Mond dreht sich genau in der Zeit einmal um sich selbst, in der er einmal um die Erde läuft – ' +
          'darum zeigt er uns immer dieselbe Seite, die Markierung zeigt auf ihre Mitte. Die Rückseite ist ' +
          'aber nicht dunkel: Bei Neumond liegt gerade sie im vollen Sonnenlicht. Und von einem Neumond zum ' +
          'nächsten vergehen 29,5 Tage, etwa zwei Tage mehr als die 27,3 Tage, die der Mond für eine Runde ' +
          'um die Erde braucht: Inzwischen ist die Erde auf ihrer Bahn weitergezogen, und der Mond braucht ' +
          'etwas länger, bis er wieder in einer Linie mit der Sonne steht.',
      },
      'evening-crescent': {
        title: 'Vom Boden aus: Sichel am Abend',
        text:
          'Etwa drei Tage nach Neumond, kurz nach Sonnenuntergang, schau nach Westen: Eine schmale Sichel ' +
          'hängt tief über dem Leuchten, wo die Sonne verschwunden ist, die helle Seite ihr zugewandt. Der ' +
          'Rest des Mondes schimmert auch: Das ist das Erdlicht, Sonnenlicht, das von der Tagseite der Erde ' +
          'zurückgeworfen wird – die vom Mond aus gesehen fast „voll“ ist. Jeden Abend steht der Mond etwa ' +
          '12° weiter von der Sonne entfernt, und seine Sichel wächst.',
      },
      'first-quarter': {
        title: 'Erstes Viertel',
        text:
          'Eine Woche nach Neumond hat der Mond ein Viertel seines Wegs um die Erde geschafft und steht 90° ' +
          'von der Sonne entfernt. Bei Sonnenuntergang steht er im Süden, seine rechte Hälfte beleuchtet ' +
          '(von der Südhalbkugel aus die linke). „Viertel“ heißt er wegen seiner Position auf der Bahn, ' +
          'nicht wegen seiner Form.',
      },
      'full-moon': {
        title: 'Der Vollmond geht auf',
        text:
          'Zwei Wochen nach Neumond steht der Mond der Sonne gegenüber: Während die Sonne im Westen ' +
          'untergeht, geht im Osten der Vollmond auf und bleibt die ganze Nacht am Himmel. Achte in der ' +
          'Dämmerung über dem Osthorizont auf ein rosa Band – den Venusgürtel, wo Sonnenlicht noch die hohe ' +
          'Luft erreicht – über dem dunkleren Blau des Erdschattens selbst.',
      },
      'last-quarter': {
        title: 'Letztes Viertel',
        text:
          'Nach drei Wochen hat der Mond drei Viertel seiner Runde hinter sich. Er geht um Mitternacht auf ' +
          'und steht bei Sonnenaufgang noch am Südhimmel, jetzt links beleuchtet. In der nächsten Woche ' +
          'schrumpft er wieder zu einer schmalen Sichel im Morgengrauen – und dann zum Neumond, wenn er ' +
          'zwischen Sonne und Erde hindurchzieht und eine Sonnenfinsternis auslösen kann.',
      },
    },
  },
  solarEclipse: {
    title: 'Was passiert bei einer Sonnenfinsternis?',
    note: (tiltExaggeration, skyEnlargement) =>
      'Nicht maßstäblich: Sonne, Mond und Erde sind viel näher beieinander gezeichnet, als sie sind, die ' +
      `Mondbahn ist etwa ${tiltExaggeration}-mal steiler geneigt als die echten 5°, und vom Boden aus ` +
      `sehen Sonne und Mond etwa ${skyEnlargement}-mal größer aus als am Himmel. Naturgetreu: wie groß ` +
      'Erde und Mond im Vergleich sind, und dass der Mond fast genau so groß aussieht wie die Sonne.',
    chapters: {
      'new-moon': {
        title: 'Neumond: Sonne, Mond und Erde in einer Reihe',
        text:
          'Der Mond umrundet die Erde alle 29,5 Tage. Bei Neumond zieht er zwischen Sonne und Erde hindurch ' +
          '– und wenn die drei genau in einer Linie stehen, verdeckt der Mond das Sonnenlicht und sein ' +
          'Schatten fällt auf die Erde: eine Sonnenfinsternis. Der Schatten hat zwei Teile. Im Kernschatten ' +
          '(zwischen den roten Linien) verdeckt der Mond die ganze Sonne; er läuft knapp hinter der ' +
          'Erdoberfläche spitz zu und trifft die Erde deshalb nur als kleiner Fleck. Im viel breiteren ' +
          'Halbschatten (zwischen den blauen Linien) verdeckt der Mond nur einen Teil der Sonne.',
      },
      'tilted-orbit': {
        title: 'Warum nicht jeden Monat?',
        text:
          'Die Mondbahn ist um etwa 5° gegen die Bahn der Erde um die Sonne geneigt. Bei den meisten ' +
          'Neumonden zieht der Mond deshalb ein wenig über oder unter der Sonne vorbei, und sein Schatten ' +
          'verfehlt die Erde. Nur wenn Neumond nahe an einem der zwei Punkte liegt, an denen der Mond die ' +
          'Ebene der Erdbahn kreuzt, stehen Sonne, Mond und Erde in einer Linie. Während die Erde um die ' +
          'Sonne läuft, passiert das in zwei kurzen „Finsternis-Zeiten“ im Jahr – darum gibt es nur zwei ' +
          'bis fünf Sonnenfinsternisse pro Jahr.',
      },
      'shadow-on-earth': {
        title: 'Der Mondschatten auf der Erde',
        text:
          'Aus dem All gesehen ist der Mondschatten ein dunkler Fleck, der über die Tagseite der Erde zieht ' +
          '– Satelliten fotografieren ihn bei jeder Finsternis. Wer im Halbschatten (blau) steht, einem ' +
          'Gebiet Tausende Kilometer breit, sieht eine partielle Finsternis. Nur im Kernschatten (rot), ' +
          'höchstens etwa 270 km breit, verschwindet die Sonne ganz. Der Kernschatten rast mit 1.700 km/h ' +
          'oder mehr über die Erde und zieht eine schmale „Totalitätszone“, deshalb dauert die Totalität an ' +
          'einem Ort nur wenige Minuten – nie länger als etwa 7,5.',
      },
      'first-contact': {
        title: 'Vom Boden aus: nur ein sonniger Tag?',
        text:
          'Jetzt stehen wir auf der Erde, in der Totalitätszone. Der Mond hat schon begonnen, die Sonne von ' +
          'ihrem Westrand her zu verdecken – aber das würde niemand merken: Der Himmel bleibt strahlend ' +
          'blau, und die Sonne blendet immer noch viel zu sehr, um hineinzusehen. Schau nie direkt in die ' +
          'Sonne, nicht einmal kurz und auch nicht, wenn sie schon fast ganz bedeckt ist: Das kann die ' +
          'Netzhaut für immer verbrennen, ohne dass es wehtut.',
      },
      partial: {
        title: 'Durch die Finsternisbrille: ein Biss aus der Sonne',
        text:
          'Finsternisbrillen (nach der Norm ISO 12312-2; Sonnenbrillen reichen bei Weitem nicht) lassen nur ' +
          'etwa ein Hunderttausendstel des Sonnenlichts durch. Alles andere wird schwarz, und die Sonne ' +
          'zeigt sich als das, was sie geworden ist: eine Sichel, die etwa eine Stunde lang immer schmaler ' +
          'wird, während der Mond über sie gleitet. Das Tageslicht ändert sich kaum, bis fast die ganze ' +
          'Sonne bedeckt ist.',
      },
      'diamond-ring': {
        title: 'Der Diamantring',
        text:
          'Sekunden vor der Totalität scheinen die letzten Sonnenstrahlen durch Täler am Mondrand, und die ' +
          'leuchtende äußere Atmosphäre der Sonne zeigt sich um den dunklen Mond: der Diamantring. Das Licht ' +
          'schwindet jetzt innerhalb von Sekunden, und der Himmel wird dunkel. Lass die Finsternisbrille auf, ' +
          'bis der Diamant erloschen ist.',
      },
      totality: {
        title: 'Totalität',
        text:
          'Der Mond verdeckt die ganze Sonne – jetzt, und nur jetzt, darfst du ohne Brille hinsehen. Die ' +
          'Korona erscheint, die äußere Atmosphäre der Sonne, über eine Million Grad heiß, mit roten ' +
          'Protuberanzen am Mondrand. Der Himmel wird tiefblau, ein Abendrot umgibt den ganzen Horizont, die ' +
          'hellsten Sterne und Planeten tauchen auf, und es wird spürbar kühler. Eine perfekte Passform: Die ' +
          'Sonne ist etwa 400-mal breiter als der Mond, aber auch etwa 400-mal weiter weg. Die nächste totale ' +
          'Finsternis am 2. August 2027 zieht über Südspanien, Nordafrika und Ägypten.',
      },
      annular: {
        title: 'Feuerring',
        text:
          'Die Mondbahn ist kein perfekter Kreis. Kommt eine Finsternis, während der Mond nahe seinem ' +
          'erdfernsten Punkt steht, sieht er etwas kleiner aus als die Sonne und kann sie nicht ganz ' +
          'verdecken: Sein Kernschatten endet, bevor er die Erde erreicht, und ein Feuerring bleibt um den ' +
          'Mond stehen. Bei dieser ringförmigen Finsternis wird es nie dunkel, und die Korona bleibt ' +
          'verborgen – die Finsternisbrille bleibt die ganze Zeit auf.',
      },
    },
  },
  planetSizes: {
    title: 'Lerne die Planeten kennen',
    note: 'Die Größen stimmen. Die Abstände nicht: Die Planeten stehen nebeneinander aufgereiht.',
    lineup: {
      title: 'Das Sonnensystem, maßstabsgetreu',
      text:
        'Die Sonne und alle 8 Planeten nebeneinander, in ihren echten Größenverhältnissen. ' +
        'Die Sonne allein enthält etwa 99,8 % der Masse des Sonnensystems – sie lässt sogar Jupiter, den ' +
        'größten Planeten, klein aussehen, der wiederum die Erde winzig wirken lässt. Diese Reihe zeigt nur ' +
        'die Größe, nicht den Abstand: Mit ihren echten Abständen (Lichtstunden bis Lichttage voneinander ' +
        'entfernt) lägen die Planeten weit außerhalb jedes einzelnen Bildes. Zuerst stehen sie in ihrer ' +
        'Reihenfolge von der Sonne aus; „Sortieren“ reiht sie nach Größe, Masse, Temperatur und mehr auf. ' +
        'Die folgenden Seiten fliegen nacheinander zu jedem Planeten, mit seinen eigenen Zahlen.',
    },
  },
}
