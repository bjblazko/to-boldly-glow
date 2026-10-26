import type { Locale } from '../../i18n/locale'

// What the narrator says when the planets lesson lines the planets up another way: the order, and
// the planets in it (their names, in that order). Numbers as in the tour's scripts.
export type OrderLines = Record<string, (names: string[]) => string>

const listEn = (names: string[]) => `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
const listDe = (names: string[]) => `${names.slice(0, -1).join(', ')} und ${names.at(-1)}`

const en: OrderLines = {
  distance: (names) => `Back in their order out from the Sun: ${listEn(names)}.`,
  size: (names) => `By size, from the largest to the smallest: ${listEn(names)}.`,
  mass: (names) => `By mass, from the heaviest to the lightest: ${listEn(names)}.`,
  type: (names) =>
    `Rock, gas or ice: first the rocky planets, ${listEn(names.slice(0, 4))}. Then the gas giants, ` +
    `${listEn(names.slice(4, 6))}. And last the ice giants, ${listEn(names.slice(6))}.`,
  speed: (names) =>
    `By their speed around the Sun, from the fastest to the slowest: ${listEn(names)}. ` +
    'The closer a planet is to the Sun, the faster it flies.',
  day: (names) => `By the length of a day, from one sunrise to the next, from the shortest to the longest: ${listEn(names)}.`,
  year: (names) => `By the length of a year, from the shortest to the longest: ${listEn(names)}.`,
  temperature: (names) => `By temperature, from the hottest to the coldest: ${listEn(names)}. On the giants, that is at the top of their clouds.`,
  density: (names) => `By density, from the densest to the lightest: ${listEn(names)}. Saturn is lighter than water - it would float.`,
  gravity: (names) => `By gravity - how heavy you would feel there - from the strongest to the weakest: ${listEn(names)}.`,
  tilt: (names) =>
    `By how far their axes are tilted, from the most upright to the most tipped over: ${listEn(names)}. ` +
    'Beyond 90 degrees, a planet spins backwards.',
}

const de: OrderLines = {
  distance: (names) => `Wieder in ihrer Reihenfolge von der Sonne aus: ${listDe(names)}.`,
  size: (names) => `Nach Größe, vom größten zum kleinsten: ${listDe(names)}.`,
  mass: (names) => `Nach Masse, vom schwersten zum leichtesten: ${listDe(names)}.`,
  type: (names) =>
    `Gestein, Gas oder Eis: zuerst die Gesteinsplaneten, ${listDe(names.slice(0, 4))}. Dann die Gasriesen, ` +
    `${listDe(names.slice(4, 6))}. Und zuletzt die Eisriesen, ${listDe(names.slice(6))}.`,
  speed: (names) =>
    `Nach ihrem Tempo um die Sonne, vom schnellsten zum langsamsten: ${listDe(names)}. ` +
    'Je näher ein Planet an der Sonne ist, desto schneller fliegt er.',
  day: (names) => `Nach der Länge eines Tages, von einem Sonnenaufgang zum nächsten, vom kürzesten zum längsten: ${listDe(names)}.`,
  year: (names) => `Nach der Länge eines Jahres, vom kürzesten zum längsten: ${listDe(names)}.`,
  temperature: (names) => `Nach Temperatur, vom heißesten zum kältesten: ${listDe(names)}. Bei den Riesen gilt das oben an ihren Wolken.`,
  density: (names) => `Nach Dichte, vom dichtesten zum leichtesten: ${listDe(names)}. Saturn ist leichter als Wasser – er würde schwimmen.`,
  gravity: (names) => `Nach Schwerkraft – wie schwer du dich dort fühlen würdest –, von der stärksten zur schwächsten: ${listDe(names)}.`,
  tilt: (names) =>
    `Nach der Neigung ihrer Achse, vom aufrechtesten zum am stärksten gekippten: ${listDe(names)}. ` +
    'Über 90 Grad dreht sich ein Planet rückwärts.',
}

export const ORDER_LINES: Record<Locale, OrderLines> = { en, de }
