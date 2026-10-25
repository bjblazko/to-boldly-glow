// The narration's words, a sentence or two at a time, timed along the clip: each piece gets a share
// of the clip's length in proportion to its characters.
export interface SubtitleCue {
  text: string
  from: number
  to: number
}

const MAX_CUE_CHARACTERS = 110

export function subtitleCues(text: string, seconds: number): SubtitleCue[] {
  const pieces = splitIntoPieces(text)
  const total = pieces.reduce((sum, piece) => sum + piece.length, 0)
  let at = 0
  return pieces.map((piece) => {
    const from = at
    at += (piece.length / total) * seconds
    return { text: piece, from, to: at }
  })
}

// Sentences, joined while short enough to read together and split at a comma or dash when too long.
function splitIntoPieces(text: string): string[] {
  // A sentence ends at a stop followed by a space - not at the point in 99.8.
  const sentences = text.split(/(?<=[.!?]["”“]?)\s+/).filter(Boolean)
  return sentences.flatMap(splitLong).reduce<string[]>((pieces, sentence) => {
    const last = pieces.at(-1)
    if (last && last.length + sentence.length + 1 <= MAX_CUE_CHARACTERS / 2) pieces[pieces.length - 1] = `${last} ${sentence}`
    else pieces.push(sentence)
    return pieces
  }, [])
}

function splitLong(sentence: string): string[] {
  if (sentence.length <= MAX_CUE_CHARACTERS) return [sentence]
  const middle = sentence.length / 2
  const breaks = [...sentence.matchAll(/[,:;–-] /g)].map((match) => match.index + 1)
  if (breaks.length === 0) return [sentence]
  const at = breaks.reduce((best, index) => (Math.abs(index - middle) < Math.abs(best - middle) ? index : best))
  return [...splitLong(sentence.slice(0, at).trim()), ...splitLong(sentence.slice(at).trim())]
}

export function cueAt(cues: readonly SubtitleCue[], seconds: number): SubtitleCue | null {
  return cues.find((cue) => seconds < cue.to) ?? null
}
