// The Apollo 11 lesson's recordings from the time: NASA's own files, cut where the words are (found
// with a speech recogniser over NASA's tapes, then checked against NASA's raw air-to-ground
// transcript). NASA content is generally not subject to copyright in the United States; NASA is named
// as the source (CREDITS.md, the app's credits). Each clip plays after the narrator, in its chapter.

const HISTORICAL_SOUNDS = 'https://www.nasa.gov/wp-content/uploads/2015/01/'
// NASA's Apollo 11 audio, digitized by the Houston Audio Control Room at Johnson Space Center and
// published on the Internet Archive (item "Apollo11Audio", public domain mark).
const JSC_TAPES = 'https://archive.org/download/Apollo11Audio/'

export interface OriginalClip {
  // The lesson chapter it belongs to.
  chapter: 'launch' | 'tli' | 'landing' | 'surface' | 'liftoff' | 'splashdown'
  source: string
  // Where in the source the clip starts and ends, in seconds (end null: to the source's end).
  from: number
  to: number | null
}

export const APOLLO11_CLIPS: readonly OriginalClip[] = [
  // Jack King at Kennedy, "Ignition sequence start ... liftoff on Apollo 11" ("Tower cleared" after it is cut).
  { chapter: 'launch', source: `${HISTORICAL_SOUNDS}590320main_ringtone_apollo11_countdown.mp3`, from: 0, to: 17.7 },
  // Mission commentary tape 155-AAA, at GET about 2:27: McCandless "You are go for TLI", Collins thanks him.
  { chapter: 'tli', source: `${JSC_TAPES}155-AAA.mp3`, from: 10068.7, to: 10079.3 },
  // Armstrong "Tranquility Base here. The Eagle has landed", and Duke's answer.
  { chapter: 'landing', source: `${HISTORICAL_SOUNDS}590333main_ringtone_eagleHasLanded_extended.mp3`, from: 0, to: null },
  // Eagle's own recorder at the liftoff from the Moon (NASA's "Apollo 11 Onboard Audio Highlight
  // Clip 5", JSC): Aldrin's countdown and the switches, "We're off", "Beautiful".
  { chapter: 'liftoff', source: `${JSC_TAPES}Apollo11OnboardAudioHighlightClip5.mp3`, from: 78.4, to: 96.4 },
  // Armstrong's first step.
  { chapter: 'surface', source: `${HISTORICAL_SOUNDS}590331main_ringtone_smallStep.mp3`, from: 0, to: null },
]
