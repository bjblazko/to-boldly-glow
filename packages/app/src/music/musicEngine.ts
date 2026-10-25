import { Composer, GROOVE_BAR, STEPS_PER_BAR, type MusicEvent } from './composer'
import { Instruments, vinylBuffer } from './instruments'
import type { MusicTrack } from './musicTracks'

// Bars are written this far ahead of the audio clock, checked this often: enough to ride out a
// busy frame, short enough that a new track or volume is heard at once.
const LOOKAHEAD_SECONDS = 1
const SCHEDULE_INTERVAL_MS = 200
const FADE_SECONDS = 1.2
// While the narrator speaks, the music steps back to this share of its volume.
const DUCKED = 0.4
const DUCK_SECONDS = 0.35
const VINYL_SECONDS = 4
const WOBBLE_HZ = 0.35
const WOBBLE_CENTS = 7

// The background music: one track at a time, played live, fading into the next. The browser lets
// it make sound only after a click or a key on the page, so until then it waits for one.
export class MusicEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private playing: Performance | null = null
  private volume = 0.5
  private ducked = false

  constructor() {
    document.addEventListener('visibilitychange', () => this.followVisibility())
  }

  play(track: MusicTrack | null): void {
    const taking = this.playing
    taking?.fadeOut()
    this.playing = null
    if (!track) return
    const ctx = this.context()
    this.playing = new Performance(ctx, this.master!, track, taking ? GROOVE_BAR : 0)
    this.wake()
  }

  // From 0 to 1.
  setVolume(volume: number): void {
    this.volume = volume
    this.applyLevel(0.05)
  }

  duck(ducked: boolean): void {
    this.ducked = ducked
    this.applyLevel(DUCK_SECONDS)
  }

  private context(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.master = new GainNode(this.ctx, { gain: 0 })
      this.master.connect(this.ctx.destination)
      this.applyLevel(0.05)
    }
    return this.ctx
  }

  private applyLevel(seconds: number): void {
    if (!this.ctx || !this.master) return
    // Loudness follows the square of the slider.
    const level = this.volume ** 2 * (this.ducked ? DUCKED : 1)
    this.master.gain.setTargetAtTime(level, this.ctx.currentTime, seconds / 3)
  }

  // Resumes now if a click is under way; otherwise on the next one.
  private wake(): void {
    const ctx = this.ctx!
    if (ctx.state === 'running' || document.hidden) return
    void ctx.resume()
    const resume = () => {
      if (this.playing && !document.hidden) void ctx.resume()
    }
    for (const type of ['pointerdown', 'keydown']) window.addEventListener(type, resume, { once: true, capture: true })
  }

  // A hidden tab stops the music (and its clock) and picks it up where it was.
  private followVisibility(): void {
    if (!this.ctx) return
    if (document.hidden) void this.ctx.suspend()
    else if (this.playing) this.wake()
  }
}

// One track playing: its own mix bus, echo and crackle, and a scheduler writing bar after bar.
class Performance {
  private readonly bus: GainNode
  private readonly instruments: Instruments
  private readonly composer: Composer
  private readonly timer: ReturnType<typeof setInterval>
  private readonly sources: AudioScheduledSourceNode[] = []
  private nextBarTime: number

  constructor(
    private readonly ctx: AudioContext,
    master: AudioNode,
    private readonly track: MusicTrack,
    // Where in the song to start: past the intro when taking over from another track.
    private bar: number,
  ) {
    this.bus = new GainNode(ctx, { gain: 0 })
    this.bus.gain.setTargetAtTime(1, ctx.currentTime, FADE_SECONDS / 3)
    this.bus.connect(master)
    this.instruments = new Instruments(ctx, this.mix(), track)
    this.composer = new Composer(track)
    this.nextBarTime = ctx.currentTime + 0.1
    this.timer = setInterval(() => this.schedule(), SCHEDULE_INTERVAL_MS)
    this.schedule()
  }

  fadeOut(): void {
    clearInterval(this.timer)
    const now = this.ctx.currentTime
    this.bus.gain.cancelScheduledValues(now)
    this.bus.gain.setTargetAtTime(0, now, FADE_SECONDS / 3)
    setTimeout(
      () => {
        for (const source of this.sources) source.stop()
        this.bus.disconnect()
      },
      FADE_SECONDS * 2 * 1000,
    )
  }

  // Low-passed and gently saturated, like a worn tape: the instruments and the echo go in here.
  private mix() {
    const ctx = this.ctx
    const tone = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: this.track.cutoff, Q: 0.5 })
    const tape = new WaveShaperNode(ctx, { curve: softClip(), oversample: '2x' })
    tone.connect(tape).connect(this.bus)
    if (this.track.sweep) this.sweep(tone)
    const echo = this.echo(tone)
    this.loop(new AudioBufferSourceNode(ctx, { buffer: vinylBuffer(ctx, VINYL_SECONDS), loop: true }), new GainNode(ctx, { gain: 0.5 }), this.bus)
    const wobble = new GainNode(ctx, { gain: WOBBLE_CENTS })
    this.loop(new OscillatorNode(ctx, { frequency: WOBBLE_HZ }), wobble)
    return { out: tone, echo, wobble }
  }

  // Opens and closes the low-pass over eight bars, between a third and five thirds of its cutoff.
  private sweep(tone: BiquadFilterNode): void {
    const depth = new GainNode(this.ctx, { gain: this.track.cutoff * (2 / 3) })
    depth.connect(tone.frequency)
    this.loop(new OscillatorNode(this.ctx, { frequency: this.track.bpm / 60 / 32 }), depth)
  }

  // A dotted-eighth echo, each repeat darker.
  private echo(out: AudioNode): AudioNode {
    const ctx = this.ctx
    const step = 60 / this.track.bpm / 4
    const delay = new DelayNode(ctx, { delayTime: 3 * step, maxDelayTime: 2 })
    const feedback = new GainNode(ctx, { gain: 0.38 })
    const dark = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 2200 })
    delay.connect(dark).connect(feedback).connect(delay)
    dark.connect(out)
    return delay
  }

  private loop(source: AudioScheduledSourceNode, through: AudioNode, to?: AudioNode): void {
    source.connect(through)
    if (to) through.connect(to)
    source.start()
    this.sources.push(source)
  }

  private schedule(): void {
    while (this.nextBarTime < this.ctx.currentTime + LOOKAHEAD_SECONDS) {
      for (const event of this.composer.bar(this.bar)) this.sound(event)
      this.bar++
      this.nextBarTime += STEPS_PER_BAR * this.stepSeconds()
    }
  }

  private sound(event: MusicEvent): void {
    const time = this.nextBarTime + this.stepTime(event.step)
    const seconds = 'steps' in event ? event.steps * this.stepSeconds() : 0
    const play = this.instruments
    if (event.kind === 'keys') play.keys(time, event.notes, seconds, event.velocity)
    else if (event.kind === 'bass') play.bass(time, event.note, seconds, event.velocity)
    else if (event.kind === 'lead') play.lead(time, event.note, seconds, event.velocity)
    else play[event.kind](time, event.velocity)
  }

  private stepSeconds(): number {
    return 60 / this.track.bpm / 4
  }

  // Every second sixteenth comes a little late: the swing.
  private stepTime(step: number): number {
    return (step + (step % 2 === 1 ? this.track.swing : 0)) * this.stepSeconds()
  }
}

function softClip(): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(1024)
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1
    curve[i] = Math.tanh(1.6 * x) / Math.tanh(1.6)
  }
  return curve
}
