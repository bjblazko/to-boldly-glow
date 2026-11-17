// A link (and the end-to-end tests) can ask for a still start, without the welcome card, with
// ?tour=off. Otherwise the card offers the narrated tour - and nothing flies until a click asks for
// it: the browser lets the narrator speak only after one, and a tour without its voice would look as
// if it had none.
export function startupTourWanted(search: string): boolean {
  return new URLSearchParams(search).get('tour') !== 'off'
}
