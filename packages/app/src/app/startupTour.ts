type SmallStorage = Pick<Storage, 'getItem' | 'setItem'>

const SEEN_KEY = 'toBoldlyGlow.startPageSeen'

// The start page (the narrated tour, the other tours, the lessons) opens by itself on a visitor's
// very first visit, so the tour is found; afterwards only from the bar's Start button. A link (and
// the end-to-end tests) can ask for a still start with ?tour=off. Nothing flies before a click
// either way: the browser lets the narrator speak only after one.
export function startPageWanted(search: string, seen: boolean): boolean {
  return !seen && new URLSearchParams(search).get('tour') !== 'off'
}

// Whether the start page has opened by itself before, in this browser (private windows and
// blocked site data count as a first visit every time).
export function startPageSeen(storage: SmallStorage | null = browserStorage()): boolean {
  try {
    return storage?.getItem(SEEN_KEY) === 'true'
  } catch {
    return false
  }
}

export function markStartPageSeen(storage: SmallStorage | null = browserStorage()): void {
  try {
    storage?.setItem(SEEN_KEY, 'true')
  } catch {
    // Blocked: the start page just opens again next time.
  }
}

function browserStorage(): SmallStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}
