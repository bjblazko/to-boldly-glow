import type { MusicTrack } from './musicTracks'

// The synthesizer's voices, each a few oscillators or a burst of noise with an envelope. Every call
// schedules one note at an audio-clock time; the nodes it makes go away once it has sounded.

const SILENCE = 0.0001
const NOISE_SECONDS = 2
// The 8-bit noise channel holds each random value this many samples: grainy, not hissing.
const CHIP_NOISE_HOLD = 12
const PULSE_HARMONICS = 32

export interface InstrumentRouting {
  // The dry mix.
  out: AudioNode
  // The echo's input: what is sent here comes back delayed.
  echo: AudioNode
  // A slow wobble in cents, for the worn-tape sound of the keys and the lead.
  wobble: AudioNode
}

interface ChordSound {
  amp: GainNode
  cutoff: number
  layers: (readonly [OscillatorType, number, number])[]
}

export function midiToHz(note: number): number {
  return 440 * 2 ** ((note - 69) / 12)
}

export class Instruments {
  private readonly noise: AudioBuffer
  private readonly chipNoise: AudioBuffer
  private readonly pulse: PeriodicWave

  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly routing: InstrumentRouting,
    private readonly track: MusicTrack,
  ) {
    this.noise = noiseBuffer(ctx, 1)
    this.chipNoise = noiseBuffer(ctx, CHIP_NOISE_HOLD)
    this.pulse = pulseWave(ctx, track.lead.duty)
  }

  // A soft, round kick: a sine falling from 110 to 42 Hz.
  kick(time: number, velocity: number): void {
    const osc = this.ctx.createOscillator()
    osc.frequency.setValueAtTime(110, time)
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.14)
    this.play(osc, this.envelope(time, 0.75 * velocity, 0.004, 0.32), time, 0.4)
  }

  // A dusty snare: band-passed noise with a little body under it.
  snare(time: number, velocity: number): void {
    const filter = new BiquadFilterNode(this.ctx, { type: 'bandpass', frequency: 1700, Q: 0.7 })
    this.playNoise(this.noise, [filter, this.envelope(time, 0.26 * velocity, 0.002, 0.2)], time, 0.25)
    const body = new OscillatorNode(this.ctx, { type: 'triangle', frequency: 190 })
    this.play(body, this.envelope(time, 0.12 * velocity, 0.002, 0.08), time, 0.12)
  }

  hat(time: number, velocity: number): void {
    const filter = new BiquadFilterNode(this.ctx, { type: 'highpass', frequency: this.track.chipHats ? 5000 : 7500 })
    const buffer = this.track.chipHats ? this.chipNoise : this.noise
    this.playNoise(buffer, [filter, this.envelope(time, 0.09 * velocity, 0.001, 0.045)], time, 0.08)
  }

  // The chords, in the track's own sound.
  keys(time: number, notes: number[], seconds: number, velocity: number): void {
    if (this.track.keys === 'pad') this.pad(time, notes, seconds, velocity)
    else if (this.track.keys === 'chip') this.chipChord(time, notes, seconds, velocity)
    else this.piano(time, notes, seconds, velocity)
  }

  // Electric-piano-like: a sine and a quiet, slightly sharp triangle per note, struck and dying
  // away over the chord's length.
  private piano(time: number, notes: number[], seconds: number, velocity: number): void {
    const amp = this.envelope(time, 0.05 * velocity, 0.02, seconds)
    this.chord(time, notes, seconds, { amp, cutoff: 1500, layers: [['sine', 0, 1], ['triangle', 6, 0.35]] })
  }

  // A soft pad: swelling in slowly, holding, and fading out past the chord's end.
  private pad(time: number, notes: number[], seconds: number, velocity: number): void {
    const peak = 0.035 * velocity
    const amp = new GainNode(this.ctx, { gain: 0 })
    amp.gain.setValueAtTime(0, time)
    amp.gain.linearRampToValueAtTime(peak, time + 0.9)
    amp.gain.setValueAtTime(peak, time + seconds * 0.7)
    amp.gain.linearRampToValueAtTime(0, time + seconds + 1.2)
    this.chord(time, notes, seconds + 1.3, { amp, cutoff: 900, layers: [['sine', -8, 1], ['triangle', 8, 0.5]] })
  }

  // An old console's chord: one pulse voice racing through the notes, thirty a second.
  private chipChord(time: number, notes: number[], seconds: number, velocity: number): void {
    const osc = this.ctx.createOscillator()
    osc.setPeriodicWave(this.pulse)
    for (let at = 0, i = 0; at < seconds; at += 1 / 30, i++) osc.frequency.setValueAtTime(midiToHz(notes[i % notes.length]), time + at)
    const amp = this.envelope(time, 0.03 * velocity, 0.005, seconds)
    osc.connect(amp).connect(this.routing.out)
    this.start(osc, time, seconds + 0.05)
  }

  // Every note in each layer (a wave, its detune in cents and its level), through one envelope.
  private chord(time: number, notes: number[], seconds: number, { amp, cutoff, layers }: ChordSound): void {
    const filter = new BiquadFilterNode(this.ctx, { type: 'lowpass', frequency: cutoff })
    amp.connect(filter).connect(this.routing.out)
    for (const note of notes) {
      for (const [type, detune, level] of layers) {
        const osc = new OscillatorNode(this.ctx, { type, frequency: midiToHz(note), detune })
        osc.connect(new GainNode(this.ctx, { gain: level })).connect(amp)
        this.wobbled(osc)
        this.start(osc, time, seconds + 0.1)
      }
    }
  }

  bass(time: number, note: number, seconds: number, velocity: number): void {
    const osc = new OscillatorNode(this.ctx, { type: this.track.bassWave, frequency: midiToHz(note) })
    const filter = new BiquadFilterNode(this.ctx, { type: 'lowpass', frequency: 420 })
    const amp = this.envelope(time, 0.32 * velocity, 0.01, seconds)
    osc.connect(filter).connect(amp).connect(this.routing.out)
    this.start(osc, time, seconds + 0.1)
  }

  // A sub-bass: a sine dropping a little into its note for a punch, with a quiet octave above so
  // small speakers still hint at it.
  sub(time: number, note: number, seconds: number, velocity: number): void {
    const amp = this.envelope(time, 0.42 * velocity, 0.008, seconds)
    amp.connect(this.routing.out)
    for (const [octave, level] of [[1, 1], [2, 0.22]]) {
      const osc = new OscillatorNode(this.ctx, { frequency: midiToHz(note) * octave })
      osc.frequency.setValueAtTime(midiToHz(note + 3) * octave, time)
      osc.frequency.exponentialRampToValueAtTime(midiToHz(note) * octave, time + 0.06)
      osc.connect(new GainNode(this.ctx, { gain: level })).connect(amp)
      this.start(osc, time, seconds + 0.1)
    }
  }

  // The 8-bit lead: a pulse wave, short and plucked, half of it into the echo.
  lead(time: number, note: number, seconds: number, velocity: number): void {
    const osc = this.ctx.createOscillator()
    osc.setPeriodicWave(this.pulse)
    osc.frequency.value = midiToHz(note)
    const amp = this.envelope(time, 0.035 * velocity, 0.004, Math.max(0.12, seconds))
    osc.connect(amp)
    amp.connect(this.routing.out)
    amp.connect(new GainNode(this.ctx, { gain: 0.6 })).connect(this.routing.echo)
    this.wobbled(osc)
    this.start(osc, time, seconds + 0.2)
  }

  // A gain that rises to `peak` and dies away exponentially.
  private envelope(time: number, peak: number, attack: number, decay: number): GainNode {
    const gain = new GainNode(this.ctx, { gain: SILENCE })
    gain.gain.setValueAtTime(SILENCE, time)
    gain.gain.exponentialRampToValueAtTime(peak, time + attack)
    gain.gain.exponentialRampToValueAtTime(SILENCE, time + attack + decay)
    return gain
  }

  private play(source: AudioScheduledSourceNode, amp: GainNode, time: number, seconds: number): void {
    source.connect(amp).connect(this.routing.out)
    this.start(source, time, seconds)
  }

  private playNoise(buffer: AudioBuffer, [filter, amp]: [AudioNode, AudioNode], time: number, seconds: number): void {
    const source = new AudioBufferSourceNode(this.ctx, { buffer, loop: true, loopStart: 0, loopEnd: NOISE_SECONDS })
    source.connect(filter).connect(amp).connect(this.routing.out)
    source.start(time, Math.random() * (NOISE_SECONDS - seconds))
    source.stop(time + seconds)
  }

  private start(source: AudioScheduledSourceNode, time: number, seconds: number): void {
    source.start(time)
    source.stop(time + seconds)
  }

  private wobbled(osc: OscillatorNode): void {
    this.routing.wobble.connect(osc.detune)
    osc.addEventListener('ended', () => this.routing.wobble.disconnect(osc.detune))
  }
}

// White noise; with `hold` above 1, each value repeats that many samples, like an old console's.
function noiseBuffer(ctx: BaseAudioContext, hold: number): AudioBuffer {
  const buffer = ctx.createBuffer(1, NOISE_SECONDS * ctx.sampleRate, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  let value = 0
  for (let i = 0; i < data.length; i++) {
    if (i % hold === 0) value = Math.random() * 2 - 1
    data[i] = value
  }
  return buffer
}

// A pulse wave high for `duty` of each cycle - 0.5 is a square, 0.125 the thin, nasal 8-bit tone.
function pulseWave(ctx: BaseAudioContext, duty: number): PeriodicWave {
  const real = new Float32Array(PULSE_HARMONICS)
  const imag = new Float32Array(PULSE_HARMONICS)
  for (let n = 1; n < PULSE_HARMONICS; n++) {
    real[n] = Math.sin(2 * Math.PI * n * duty) / (n * Math.PI)
    imag[n] = (1 - Math.cos(2 * Math.PI * n * duty)) / (n * Math.PI)
  }
  return ctx.createPeriodicWave(real, imag)
}

// The crackle and hiss of an old record, looped under the music.
export function vinylBuffer(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const buffer = ctx.createBuffer(1, seconds * ctx.sampleRate, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.012
    if (Math.random() < 0.00025) {
      const pop = (Math.random() * 2 - 1) * (0.2 + 0.5 * Math.random())
      for (let j = 0; j < 24 && i + j < data.length; j++) data[i + j] += pop * Math.exp(-j / 4)
    }
  }
  return buffer
}
