import type { Messages } from '../en'

export const credits: Messages['credits'] = {
  groups: {
    builtIn: 'In der App enthalten',
    picturesAndData: 'Bilder und Daten',
    ownWork: 'Für dieses Projekt gemacht',
  },
  uses: {
    glMatrix: 'Matrizen- und Vektorrechnung für die 3D-Ansicht',
    assemblyScript: 'Seine Laufzeit steckt in den Bahnberechnungen (WebAssembly)',
    rolldown: 'Ein paar Zeilen seiner Modul-Laufzeit, aus dem Bündeln der App',
    interTight: 'Die Schrift der Bedienelemente und Beschriftungen',
    ibmPlexMono: 'Die Schrift der Zahlen und Anzeigen',
    solarSystemScope: 'Oberflächenkarten der Sonne, der Planeten und des Mondes, und Saturns Ringe',
    nasaMoonMaps: 'Karten von Io, Europa, Ganymed, Kallisto und Titan',
    earthAtNight: 'Die Lichter der Städte auf der Erde (Robert Simmon, Suomi-NPP-VIIRS-Daten, NOAA)',
    brightStarCatalogue: 'Die rund 9.100 Sterne: Positionen, Helligkeit, Farben (Hoffleit & Warren, über CDS)',
    astronomia: 'VSOP87-Koeffizienten für die Positionen der Planeten',
    orbitalData: 'Drehachsen der Körper; Bahnen der Kometen, Zwergplaneten und Asteroiden',
    agx: 'Wie helles Licht zu Bildschirmfarben wird',
    toBoldlyGlow: 'Die App, ihr Logo, die gemalte Milchstraße, die Korona der Sonne und die Polarlichter',
  },
  changes: {
    solarSystemScope: 'Verkleinert und umbenannt; die Reliefkarten der Gasriesen sind aus ihren Farbkarten abgeleitet.',
  },
  licenses: {
    publicDomain: 'Gemeinfrei',
    facts: 'Fakten',
    ownMethod: 'Verfahren; eigener Code',
  },
}
